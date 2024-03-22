from sentry.runner import configure

configure()
from django.conf import settings
from openai import OpenAI

from sentry.llm.base import LLMBase


class OpenAIProvider(LLMBase):
    def complete_prompt(
        self, prompt: str, message: str, temperature: float, max_output_tokens: int
    ):
        model = settings.SENTRY_LLM_OPTIONS["model"]
        client = get_openai_client()

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


def get_openai_client() -> OpenAI:
    openai_api_key = settings.SENTRY_LLM_OPTIONS["openai_api_key"]
    global openai_client

    if openai_client:
        return openai_client

    # this will raise if OPENAI_API_KEY is not set
    openai_client = OpenAI(api_key=openai_api_key)

    return openai_client
