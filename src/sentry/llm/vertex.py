import logging

import google.auth
import google.auth.transport.requests
import requests

from sentry.llm.base import LLMBase

logger = logging.getLogger(__name__)


class VertexProvider(LLMBase):
    def complete_prompt(message):
        from django.conf import settings

        url = settings.SENTRY_LLM_OPTIONS["url"]
        prompt = settings.SENTRY_LLM_OPTIONS["prompt"]
        candidate_count = settings.SENTRY_LLM_OPTIONS["candidate_count"]
        max_output_tokens = settings.SENTRY_LLM_OPTIONS["max_output_tokens"]
        temp = settings.SENTRY_LLM_OPTIONS["temp"]
        top_p = settings.SENTRY_LLM_OPTIONS["top_p"]

        payload = {
            "instances": [{"content": f'{prompt}: "{message}"'}],
            "parameters": {
                "candidateCount": candidate_count,
                "maxOutputTokens": max_output_tokens,
                "temperature": temp,
                "topP": top_p,
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
