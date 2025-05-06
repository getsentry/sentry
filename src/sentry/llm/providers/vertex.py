import logging

import google.auth
import google.auth.transport.requests
from google import genai
from google.genai.types import GenerateContentConfig, HttpOptions

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

        model = usecase_config["options"]["model"]
        content = f"{prompt} {message}" if prompt else message
        generate_config = GenerateContentConfig(
            candidate_count=self.candidate_count,
            max_output_tokens=max_output_tokens,
            temperature=temperature,
            top_p=self.top_p,
        )

        client = self._create_genai_client()
        response = client.models.generate_content(
            model=model,
            contents=content,
            config=generate_config,
        )

        if response.status_code != 200:
            logger.error(
                "Vertex request failed.",
                extra={"status_code": response.status_code},
            )
            raise VertexRequestFailed(f"Response {response.status_code}")

        return response.text

    # Separate method to allow mocking
    def _create_genai_client(self):
        return genai.Client(
            vertexai=True,
            project=self.provider_config["options"]["gcp_project"],
            location=self.provider_config["options"]["gcp_location"],
            http_options=HttpOptions(api_version="v1"),
        )

    def _get_access_token(self) -> str:
        # https://stackoverflow.com/questions/53472429/how-to-get-a-gcp-bearer-token-programmatically-with-python

        creds, _ = google.auth.default(scopes=["https://www.googleapis.com/auth/cloud-platform"])
        creds.refresh(google.auth.transport.requests.Request())
        return creds.token
