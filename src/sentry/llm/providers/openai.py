import functools

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


@functools.cache
def get_openai_client(api_key: str) -> OpenAI:
    return OpenAI(api_key=api_key)
