import logging

import google.auth
import google.auth.transport.requests
import requests

from sentry.runner import configure

configure()
from django.conf import settings

from sentry.llm.base import LLMBase

logger = logging.getLogger(__name__)


class VertexProvider(LLMBase):
    candidate_count = 1
    max_output_tokens = 1024
    temp = 0.0
    top_p = 1

    def complete_prompt(self, prompt, message):

        url = settings.SENTRY_LLM_OPTIONS["url"]

        payload = {
            "instances": [{"content": f"{prompt} {message}"}],
            "parameters": {
                "candidateCount": self.candidate_count,
                "maxOutputTokens": self.max_output_tokens,
                "temperature": self.temp,
                "topP": self.top_p,
            },
        }

        headers = {
            "Authorization": f"Bearer {get_access_token()}",
            "Content-Type": "application/json",
        }

        response = requests.post(url, headers=headers, json=payload)

        if response.status_code == 200:
            logger.info("Request successful.")
        else:
            logger.info(
                "Request failed with status code %s: %s", response.status_code, response.text
            )

        return response.json()["predictions"][0]["content"]


def get_access_token():
    # https://stackoverflow.com/questions/53472429/how-to-get-a-gcp-bearer-token-programmatically-with-python

    creds, _ = google.auth.default()
    creds.refresh(google.auth.transport.requests.Request())
    return creds.token
