import logging
from typing import Any

import google.auth
import google.auth.transport.requests
import requests

from sentry.llm.providers.base import LlmModelBase

logger = logging.getLogger(__name__)


class VertexProvider(LlmModelBase):
    """
    A provider for Google Vertex AI. Uses default service account credentials.
    """

    provider_name = "vertex"

    def get_provider_options(self) -> dict[str, Any]:
        return self.provider_config[self.provider_name]["options"]

    candidate_count = 1  # we only want one candidate returned at the moment
    top_p = 1  # TODO: make this configurable?

    def _complete_prompt(
        self,
        *,
        usecase_config: dict[str, Any],
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
            "Authorization": f"Bearer {self._get_access_token()}",
            "Content-Type": "application/json",
        }
        vertex_url = self.provider_config["options"]["url"]
        vertex_url += usecase_config["options"]["model"] + ":predict"

        response = requests.post(vertex_url, headers=headers, json=payload)

        if response.status_code == 200:
            logger.info("Request successful.")
        else:
            logger.info(
                "Request failed with status code %s: %s", response.status_code, response.text
            )

        return response.json()["predictions"][0]["content"]

    def _get_access_token(self) -> str:
        # https://stackoverflow.com/questions/53472429/how-to-get-a-gcp-bearer-token-programmatically-with-python

        creds, _ = google.auth.default()
        creds.refresh(google.auth.transport.requests.Request())
        return creds.token
