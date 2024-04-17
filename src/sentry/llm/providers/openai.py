from typing import Any

from openai import OpenAI

from sentry.llm.providers.base import LlmModelBase


class OpenAIProvider(LlmModelBase):

    provider_name = "openai"

    def _complete_prompt(
        self,
        *,
        usecase_config: dict[str, Any],
        prompt: str,
        message: str,
        temperature: float,
        max_output_tokens: int,
    ) -> str | None:
        model = usecase_config["options"]["model"]
        client = get_openai_client(self.provider_config["options"]["api_key"])

        response = client.chat.completions.create(
            model=model,
            temperature=temperature
            * 2,  # open AI temp range is [0.0 - 2.0], so we have to multiply by two
            messages=[
                {"role": "system", "content": prompt},
                {
                    "role": "user",
                    "content": message,
                },
            ],
            stream=False,
            max_tokens=max_output_tokens,
        )

        return response.choices[0].message.content


openai_client: OpenAI | None = None


def get_openai_client(api_key: str) -> OpenAI:
    global openai_client

    if openai_client:
        return openai_client

    # this will raise if OPENAI_API_KEY is not set
    openai_client = OpenAI(api_key=api_key)

    return openai_client
