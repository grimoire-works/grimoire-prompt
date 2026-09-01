"""轻量数据库迁移：启动时为已存在的表补充缺失的列。

不引入 alembic（对本地小工具过重），只做「缺列补齐」：
- 全新数据库由 Base.metadata.create_all 直接建全表，本模块无操作
- 老库中已存在的表若缺少模型新增的列，用 ALTER TABLE ADD COLUMN 补齐
- 不做已有列的类型变更（如 String(256) → String(512)）：SQLite 不支持
  ALTER 修改列类型，检测到差异仅记录日志提示（SQLite 无长度强制可容忍；
  老 MySQL 库需人工处理）
"""

import logging

from sqlalchemy import Boolean, DateTime, Float, Integer, String, Text, inspect, text
from sqlalchemy.ext.asyncio import AsyncEngine

import backend.models  # noqa: F401  确保模型注册到 Base.metadata
from backend.database import Base

logger = logging.getLogger(__name__)


def _quote_string(value: str) -> str:
    return "'" + value.replace("'", "''") + "'"


def _server_default_for(column):
    """为 NOT NULL 列推导 ALTER TABLE ADD COLUMN 所需的默认值。

    SQLite 不允许添加无默认值的 NOT NULL 列；MySQL 同样要求已有行有值可填。
    优先级：模型 server_default > 模型标量 default > 按列类型推导。
    推导不出时返回 None（调用方将降级为可空列并告警）。
    """
    if column.server_default is not None and column.server_default.arg:
        arg = column.server_default.arg
        return str(arg.text) if hasattr(arg, "text") else str(arg)
    if column.default is not None and column.default.is_scalar:
        value = column.default.arg
        if isinstance(value, bool):
            return "1" if value else "0"
        if isinstance(value, (int, float)):
            return str(value)
        return _quote_string(str(value))
    # 按类型推导兜底默认值
    if isinstance(column.type, (Integer, Boolean)):
        return "0"
    if isinstance(column.type, Float):
        return "0"
    if isinstance(column.type, DateTime):
        return "CURRENT_TIMESTAMP"
    if isinstance(column.type, (String, Text)):
        return "''"
    return None


def _add_column(conn, table_name: str, column) -> None:
    dialect = conn.dialect
    preparer = dialect.identifier_preparer
    type_sql = column.type.compile(dialect)
    nullable_fallback = False

    if column.nullable:
        column_sql = f"{preparer.quote(column.name)} {type_sql} NULL"
    else:
        default_sql = _server_default_for(column)
        if default_sql is not None:
            column_sql = f"{preparer.quote(column.name)} {type_sql} NOT NULL DEFAULT {default_sql}"
        else:
            # 无法推导默认值：降级为可空列（SQLite 无法添加无默认值的 NOT NULL 列），
            # ORM 写入时总会提供值，功能不受影响
            column_sql = f"{preparer.quote(column.name)} {type_sql} NULL"
            nullable_fallback = True

    conn.execute(text(f"ALTER TABLE {preparer.quote(table_name)} ADD COLUMN {column_sql}"))

    if nullable_fallback:
        logger.warning("补列 %s.%s：无法推导默认值，已降级为可空列", table_name, column.name)
    else:
        logger.info("补列 %s.%s：%s", table_name, column.name, type_sql)


def _check_type_drift(table_name: str, column, existing_column, dialect) -> None:
    """检测已存在列的类型与模型定义是否一致，仅提示不做变更。"""
    try:
        existing_sql = existing_column["type"].compile(dialect)
        model_sql = column.type.compile(dialect)
    except Exception:  # noqa: BLE001  类型编译失败不影响启动
        return
    if existing_sql.upper() != model_sql.upper():
        logger.info(
            "检测到列类型差异，已跳过（不阻塞启动，老 MySQL 库如需精确变更请人工处理）: "
            "%s.%s 库内=%s 模型=%s",
            table_name,
            column.name,
            existing_sql,
            model_sql,
        )


def _ensure_columns_sync(conn) -> None:
    inspector = inspect(conn)
    existing_tables = set(inspector.get_table_names())

    for table_name, table in Base.metadata.tables.items():
        if table_name not in existing_tables:
            continue  # 新表由 create_all 直接建全
        existing_columns = {col["name"]: col for col in inspector.get_columns(table_name)}

        for column in table.columns:
            if column.name not in existing_columns:
                _add_column(conn, table_name, column)
            else:
                _check_type_drift(table_name, column, existing_columns[column.name], conn.dialect)


async def ensure_columns(engine: AsyncEngine) -> None:
    """启动时轻量迁移：为已存在的表补充模型中新增的列。

    在 create_all 之后调用；新库无操作，老库自动补列并记录 info 日志。
    """
    async with engine.begin() as conn:
        await conn.run_sync(_ensure_columns_sync)
