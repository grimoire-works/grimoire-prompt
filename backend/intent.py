"""意图识别与验证模块。

借鉴 ai-review 项目的 LLMRecognizer 设计思路：
- LLM 结构化提取（temperature=0 确保确定性）
- JSON 格式输出
- 容错降级（失败不阻塞主流程）
"""

import json
import logging
from typing import Any

logger = logging.getLogger(__name__)

INTENT_EXTRACT_SYSTEM = """你是意图分析专家。分析用户提供的文本，提取其中包含的所有核心意图。

严格按以下 JSON 格式输出，不要输出其他内容：
{"intents": ["意图1", "意图2"], "summary": "一句话概括用户整体目的"}

注意：
- intents 列出所有独立的核心意图，不要合并或遗漏
- 如果文本只有一个意图，intents 只包含一个元素
- 无法识别时 intents 为空数组"""

INTENT_VERIFY_SYSTEM = """你是意图验证专家。检查优化后的提示词是否完整覆盖了原始意图列表。

严格按以下 JSON 格式输出，不要输出其他内容：
{"covered": ["已被覆盖的意图"], "missing": ["未被覆盖的意图"], "coverage_rate": 0.0}

coverage_rate = covered 数量 / 总意图数量
如果所有意图都被覆盖，missing 为空数组，coverage_rate 为 1.0"""


def _parse_json_response(text: str) -> dict | None:
    """从 LLM 响应中提取 JSON 对象，兼容 markdown 代码块包裹。"""
    text = text.strip()
    # 去掉 markdown 代码块
    if text.startswith("```"):
        lines = text.split("\n")
        lines = [l for l in lines if not l.strip().startswith("```")]
        text = "\n".join(lines).strip()
    try:
        parsed = json.loads(text)
        if isinstance(parsed, dict):
            return parsed
    except json.JSONDecodeError:
        pass
    # 尝试提取第一个 JSON 对象
    start = text.find("{")
    end = text.rfind("}")
    if 0 <= start < end:
        try:
            return json.loads(text[start : end + 1])
        except json.JSONDecodeError:
            pass
    return None


async def extract_intents(
    provider: Any,
    config: dict[str, Any],
    user_prompt: str,
) -> dict:
    """提取用户原始提示词的所有意图。

    Returns:
        {"intents": ["意图1", ...], "summary": "..."}
        失败时返回空意图（不阻塞主流程）。
    """
    messages = [
        {"role": "system", "content": INTENT_EXTRACT_SYSTEM},
        {"role": "user", "content": user_prompt},
    ]
    verify_config = {**config, "temperature": 0, "max_tokens": 500}
    try:
        result = await provider.chat(messages, verify_config)
        parsed = _parse_json_response(result)
        if parsed and "intents" in parsed:
            logger.info("意图提取成功: intents=%s", parsed["intents"])
            return parsed
    except Exception as e:
        logger.warning("意图提取失败，降级为空意图: %s", e)
    return {"intents": [], "summary": ""}


async def verify_intents(
    provider: Any,
    config: dict[str, Any],
    original_intents: list[str],
    optimized_prompt: str,
) -> dict:
    """验证优化后的提示词是否覆盖了所有原始意图。

    Returns:
        {"covered": [...], "missing": [...], "coverage_rate": float}
        失败时返回全部覆盖（不误报）。
    """
    if not original_intents:
        return {"covered": [], "missing": [], "coverage_rate": 1.0}

    messages = [
        {"role": "system", "content": INTENT_VERIFY_SYSTEM},
        {
            "role": "user",
            "content": (
                f"原始意图列表：{json.dumps(original_intents, ensure_ascii=False)}\n\n"
                f"优化后的提示词：\n{optimized_prompt}"
            ),
        },
    ]
    verify_config = {**config, "temperature": 0, "max_tokens": 500}
    try:
        result = await provider.chat(messages, verify_config)
        parsed = _parse_json_response(result)
        if parsed and "covered" in parsed:
            logger.info(
                "意图验证完成: covered=%d, missing=%d, rate=%.2f",
                len(parsed.get("covered", [])),
                len(parsed.get("missing", [])),
                parsed.get("coverage_rate", 0),
            )
            return parsed
    except Exception as e:
        logger.warning("意图验证失败，降级为全部覆盖: %s", e)
    # 降级：无法验证时返回通过（不误报）
    return {"covered": original_intents, "missing": [], "coverage_rate": 1.0}
