import base64
import hashlib
import logging

from cryptography.fernet import Fernet, InvalidToken

from backend.config import settings

logger = logging.getLogger(__name__)

_PLACEHOLDER_KEY = "changeme_to_random_base64_key"


def _load_fernet_key() -> bytes:
    """从配置解析 Fernet 密钥（32 字节 urlsafe base64）。

    - 配置为合法 32 字节 base64 → 直接使用
    - 配置仍是占位符或非法 → 用 sha256(配置值) 派生稳定密钥，
      并打 warning 提示用户配置（不崩溃，保证向后兼容）
    """
    raw = settings.encryption_key or ""
    if raw and raw != _PLACEHOLDER_KEY:
        try:
            decoded = base64.b64decode(raw, altchars=b"-_", validate=True)
            if len(decoded) == 32:
                return base64.urlsafe_b64encode(decoded)
        except (ValueError, TypeError):
            pass
    derived = hashlib.sha256(raw.encode("utf-8")).digest()
    logger.warning(
        "ENCRYPTION_KEY 未配置为合法的 32 字节 base64 密钥，"
        "已自动派生稳定密钥（基于当前配置值 sha256）。"
        "多实例部署或更换该值会导致已有密文无法解密，"
        "请生成随机密钥：python -c \"from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())\""
    )
    return base64.urlsafe_b64encode(derived)


_fernet = Fernet(_load_fernet_key())


def encrypt_secret(plain: str | None) -> str | None:
    """加密明文，返回 Fernet 密文（urlsafe base64 字符串）。空值原样返回。"""
    if not plain:
        return plain
    return _fernet.encrypt(plain.encode("utf-8")).decode("ascii")


def decrypt_secret(cipher: str | None) -> str | None:
    """解密 Fernet 密文，返回明文。

    输入为空 → 原样返回；解密失败（历史明文数据）→ 按明文原样返回，
    保证存量明文 key 仍可用（下次保存时自动加密为密文）。
    """
    if not cipher:
        return cipher
    try:
        return _fernet.decrypt(cipher.encode("ascii")).decode("utf-8")
    except (InvalidToken, ValueError, UnicodeEncodeError):
        return cipher
