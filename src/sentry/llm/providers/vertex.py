import logging

import google.auth
import google.auth.transport.requests
import requests

from sentry.llm.providers.base import LlmModelBase
from sentry.llm.types import UseCaseProviderOptions

logger = logging.getLogger(__name__)


class VertexProvider(LlmModelBase):
    candidate_count = 1
    top_p = 1

    def complete_prompt(
        self,
        usecase_options: UseCaseProviderOptions,
        prompt: str,
        message: str,
        temperature: float,
        max_output_tokens: int,
    ) -> str | None:

        payload = {
            "instances": [{"content": f"{prompt} {message}"}],
            "parameters": {
                "candidateCount": self.candidate_count,
                "maxOutputTokens": max_output_tokens,
                "temperature": temperature,
                "topP": self.top_p,
            },
        }

        headers = {
            "Authorization": f"Bearer {get_access_token()}",
            "Content-Type": "application/json",
        }

        response = requests.post(
            self.options["vertex"]["options"]["url"], headers=headers, json=payload
        )

        if response.status_code == 200:
            logger.info("Request successful.")
        else:
            logger.info(
                "Request failed with status code %s: %s", response.status_code, response.text
            )

        return response.json()["predictions"][0]["content"]


def get_access_token() -> str:
    # https://stackoverflow.com/questions/53472429/how-to-get-a-gcp-bearer-token-programmatically-with-python

    creds, _ = google.auth.default()
    creds.refresh(google.auth.transport.requests.Request())
    return creds.token
