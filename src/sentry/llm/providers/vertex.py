import logging

import google.auth
import google.auth.transport.requests
import requests
import sentry_sdk

from sentry.llm.exceptions import VertexRequestFailed
from sentry.llm.providers.base import LlmModelBase
from sentry.llm.types import UseCaseConfig

logger = logging.getLogger(__name__)


class VertexProvider(LlmModelBase):
    """
    A provider for Google Vertex AI. Uses default service account credentials.
    """

    provider_name = "vertex"
    candidate_count = 1  # we only want one candidate returned at the moment
    top_p = 1  # TODO: make this configurable?

    def _complete_prompt(
        self,
        *,
        usecase_config: UseCaseConfig,
        prompt: str | None = None,
        message: str,
        temperature: float,
        max_output_tokens: int,
    ) -> str | None:

        content = f"{prompt} {message}" if prompt else message

        payload = {
            "contents": {
                "role": "user",
                "parts": [
                    {"text": content},
                ],
            },
            "generationConfig": {
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
        vertex_url += usecase_config["options"]["model"] + ":generateContent"

        response = requests.post(vertex_url, headers=headers, json=payload)

        if response.status_code != 200:
            sentry_sdk.set_tag("vertex.response_status_code", response.status_code)
            raise VertexRequestFailed(f"Response {response.status_code}: {response.text}")

        return response.json()["candidates"][0]["content"]["parts"][0]["text"]

    def _get_access_token(self) -> str:
        # https://stackoverflow.com/questions/53472429/how-to-get-a-gcp-bearer-token-programmatically-with-python

        creds, _ = google.auth.default(scopes=["https://www.googleapis.com/auth/cloud-platform"])
        creds.refresh(google.auth.transport.requests.Request())
        return creds.token
