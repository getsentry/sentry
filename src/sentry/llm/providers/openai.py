from openai import OpenAI
from openai.types.chat import ChatCompletionMessageParam

from sentry.llm.providers.base import LlmModelBase
from sentry.llm.types import UseCaseConfig


class OpenAIProvider(LlmModelBase):

    provider_name = "openai"

    def _complete_prompt(
        self,
        *,
        usecase_config: UseCaseConfig,
        prompt: str | None = None,
        message: str,
        temperature: float,
        max_output_tokens: int,
    ) -> str | None:
        model = usecase_config["options"]["model"]
        client = get_openai_client(self.provider_config["options"]["api_key"])

        messages: list[ChatCompletionMessageParam] = []

        if prompt:
            messages.append({"role": "system", "content": prompt})
        messages.append({"role": "user", "content": message})

        response = client.chat.completions.create(
            model=model,
            temperature=temperature
            * 2,  # open AI temp range is [0.0 - 2.0], so we have to multiply by two
            messages=messages,
            stream=False,
            max_tokens=max_output_tokens,
        )

        return response.choices[0].message.content


openai_client: OpenAI | None = None


class OpenAIClientSingleton:
    _instance = None
    client: OpenAI

    def __init__(self) -> None:
        raise RuntimeError("Call instance() instead")

    @classmethod
    def instance(cls, api_key: str) -> "OpenAIClientSingleton":
        if cls._instance is None:
            cls._instance = cls.__new__(cls)
            cls._instance.client = OpenAI(api_key=api_key)
        return cls._instance


def get_openai_client(api_key: str) -> OpenAI:
    return OpenAIClientSingleton.instance(api_key).client
