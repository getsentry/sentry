from sentry.runner import configure

configure()
from django.conf import settings
from openai import OpenAI

from sentry.llm.base import LLMBase


class OpenAIProvider(LLMBase):
    def complete_prompt(self, prompt: str, message):

        model = settings.SENTRY_LLM_OPTIONS["model"]

        client = get_openai_client()

        response = client.chat.completions.create(
            model=model,
            temperature=0.7,
            messages=[
                {"role": "system", "content": prompt},
                {
                    "role": "user",
                    "content": message,
                },
            ],
            stream=False,
        )

        return response.choices[0].message.content


openai_client: OpenAI | None = None


def get_openai_client() -> OpenAI:

    global openai_client

    if openai_client:
        return openai_client

    # this will raise if OPENAI_API_KEY is not set
    openai_client = OpenAI(api_key=settings.OPENAI_API_KEY)

    return openai_client
