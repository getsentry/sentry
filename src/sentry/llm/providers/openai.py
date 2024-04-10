from openai import OpenAI

from sentry.llm.providers.base import LlmModelBase
from sentry.llm.types import UseCaseProviderOptions


class OpenAIProvider(LlmModelBase):
    def complete_prompt(
        self,
        usecase_options: UseCaseProviderOptions,
        prompt: str,
        message: str,
        temperature: float = 0.7,
        max_output_tokens: int = 1000,
    ) -> str | None:
        model = usecase_options["model"]
        client = get_openai_client(self.options["openai"]["options"]["api_key"])

        response = client.chat.completions.create(
            model=model,
            temperature=temperature * 2,  # open AI temp range is [0.0 - 2.0]
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
    # TODO: can we make this glboal?

    openai_client = OpenAI(api_key=api_key)

    return openai_client
