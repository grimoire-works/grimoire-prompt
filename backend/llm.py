"""LLM 客户端：支持 OpenAI 兼容 API + Anthropic。"""

from abc import ABC, abstractmethod
from collections.abc import AsyncGenerator
from typing import Any

from openai import AsyncOpenAI


class LLMProvider(ABC):
    @abstractmethod
    async def chat(self, messages: list[dict[str, str]], config: dict[str, Any]) -> str:
        ...

    @abstractmethod
    async def chat_stream(
        self, messages: list[dict[str, str]], config: dict[str, Any]
    ) -> AsyncGenerator[str, None]:
        ...

    @abstractmethod
    async def test_connection(self, config: dict[str, Any]) -> bool:
        ...


class OpenAIProvider(LLMProvider):
    """处理 openai 和 openai_compatible（国产模型均走 OpenAI 兼容 API）。"""

    async def chat(self, messages: list[dict[str, str]], config: dict[str, Any]) -> str:
        client = AsyncOpenAI(api_key=config["api_key"], base_url=config.get("base_url"))
        resp = await client.chat.completions.create(
            model=config["model_name"],
            messages=messages,
            temperature=config.get("temperature", 0.7),
            max_tokens=config.get("max_tokens", 4096),
        )
        return resp.choices[0].message.content

    async def chat_stream(
        self, messages: list[dict[str, str]], config: dict[str, Any]
    ) -> AsyncGenerator[str, None]:
        client = AsyncOpenAI(api_key=config["api_key"], base_url=config.get("base_url"))
        stream = await client.chat.completions.create(
            model=config["model_name"],
            messages=messages,
            temperature=config.get("temperature", 0.7),
            max_tokens=config.get("max_tokens", 4096),
            stream=True,
        )
        async for chunk in stream:
            delta = chunk.choices[0].delta.content
            if delta:
                yield delta

    async def test_connection(self, config: dict[str, Any]) -> bool:
        try:
            client = AsyncOpenAI(api_key=config["api_key"], base_url=config.get("base_url"))
            resp = await client.chat.completions.create(
                model=config["model_name"],
                messages=[{"role": "user", "content": "reply ok"}],
                max_tokens=10,
            )
            return bool(resp.choices)
        except Exception:
            return False


class AnthropicProvider(LLMProvider):
    """处理 Anthropic Claude API（system 提到顶层参数）。"""

    async def chat(self, messages: list[dict[str, str]], config: dict[str, Any]) -> str:
        import anthropic

        client = anthropic.AsyncAnthropic(api_key=config["api_key"])
        system_msg, user_messages = self._split_system(messages)
        resp = await client.messages.create(
            model=config["model_name"],
            system=system_msg,
            messages=user_messages,
            temperature=config.get("temperature", 0.7),
            max_tokens=config.get("max_tokens", 4096),
        )
        return resp.content[0].text

    async def chat_stream(
        self, messages: list[dict[str, str]], config: dict[str, Any]
    ) -> AsyncGenerator[str, None]:
        import anthropic

        client = anthropic.AsyncAnthropic(api_key=config["api_key"])
        system_msg, user_messages = self._split_system(messages)
        async with client.messages.stream(
            model=config["model_name"],
            system=system_msg,
            messages=user_messages,
            temperature=config.get("temperature", 0.7),
            max_tokens=config.get("max_tokens", 4096),
        ) as stream:
            async for text in stream.text_stream:
                yield text

    async def test_connection(self, config: dict[str, Any]) -> bool:
        try:
            import anthropic

            client = anthropic.AsyncAnthropic(api_key=config["api_key"])
            resp = await client.messages.create(
                model=config["model_name"],
                messages=[{"role": "user", "content": "reply ok"}],
                max_tokens=10,
            )
            return bool(resp.content)
        except Exception:
            return False

    @staticmethod
    def _split_system(messages: list[dict[str, str]]) -> tuple[str, list[dict]]:
        """从消息数组中分离 system 消息（Anthropic API 要求 system 作为顶层参数）。"""
        system_parts = []
        user_messages = []
        for msg in messages:
            if msg["role"] == "system":
                system_parts.append(msg["content"])
            else:
                user_messages.append(msg)
        return "\n\n".join(system_parts), user_messages


# ── Provider 注册表 ──

PROVIDERS: dict[str, LLMProvider] = {
    "openai": OpenAIProvider(),
    "openai_compatible": OpenAIProvider(),
    "anthropic": AnthropicProvider(),
}


def get_provider(provider_name: str) -> LLMProvider:
    if provider_name not in PROVIDERS:
        raise ValueError(f"Unknown provider: {provider_name}")
    return PROVIDERS[provider_name]


def build_messages(template_content: str, user_prompt: str) -> list[dict[str, str]]:
    """从模板内容和用户输入构建消息数组。

    简单模板（纯字符串）：content 做 system，用户输入做 user。
    高级模板（JSON 数组）：解析消息数组，替换 {{originalPrompt}}。
    """
    import json

    try:
        parsed = json.loads(template_content)
        if isinstance(parsed, list):
            return [
                {"role": m["role"], "content": m["content"].replace("{{originalPrompt}}", user_prompt)}
                for m in parsed
            ]
    except (json.JSONDecodeError, KeyError):
        pass

    # 简单模板
    return [
        {"role": "system", "content": template_content},
        {"role": "user", "content": user_prompt},
    ]
