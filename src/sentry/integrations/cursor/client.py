from __future__ import annotations

import logging

from sentry.integrations.coding_agent.client import CodingAgentClient
from sentry.integrations.coding_agent.models import CodingAgentLaunchRequest
from sentry.integrations.cursor.models import (
    CursorAgentLaunchRequestBody,
    CursorAgentLaunchRequestPrompt,
    CursorAgentLaunchRequestTarget,
    CursorAgentLaunchRequestWebhook,
    CursorAgentLaunchResponse,
    CursorAgentSource,
    CursorApiKeyMetadata,
    CursorModelsResponse,
)
from sentry.seer.autofix.utils import CodingAgentProviderType, CodingAgentState, CodingAgentStatus
from sentry.shared_integrations.exceptions import (
    ApiError,
    ApiForbiddenError,
    ApiRateLimitedError,
    ApiUnauthorized,
)

logger = logging.getLogger(__name__)

NON_RETRYABLE_ERRORS = (ApiUnauthorized, ApiForbiddenError, ApiRateLimitedError)
MAX_MODEL_RETRIES = 3


class CursorAgentClient(CodingAgentClient):
    integration_name = "cursor"
    base_url = "https://api.cursor.com"
    api_key: str

    def __init__(self, api_key: str, webhook_secret: str):
        super().__init__()
        self.api_key = api_key
        self.webhook_secret = webhook_secret

    def _get_auth_headers(self) -> dict[str, str]:
        return {"Authorization": f"Bearer {self.api_key}"}

    def get_api_key_metadata(self) -> CursorApiKeyMetadata:
        """Fetch metadata about the API key from Cursor's /v0/me endpoint."""
        logger.info(
            "coding_agent.cursor.get_api_key_metadata",
            extra={"agent_type": self.__class__.__name__},
        )

        api_response = self.get(
            "/v0/me",
            headers={
                "content-type": "application/json;charset=utf-8",
                **self._get_auth_headers(),
            },
            timeout=30,
        )

        return CursorApiKeyMetadata.validate(api_response.json)

    def get_available_models(self) -> list[str]:
        """Fetch available models from Cursor's /v0/models endpoint."""
        api_response = self.get(
            "/v0/models",
            headers={
                "content-type": "application/json;charset=utf-8",
                **self._get_auth_headers(),
            },
            timeout=30,
        )

        return CursorModelsResponse.validate(api_response.json).models

    def _post_launch(
        self,
        payload: CursorAgentLaunchRequestBody,
        request: CodingAgentLaunchRequest,
    ) -> CodingAgentState:
        """Post a launch request and parse the response into a CodingAgentState."""
        api_response = self.post(
            "/v0/agents",
            headers={
                "content-type": "application/json;charset=utf-8",
                **self._get_auth_headers(),
            },
            data=payload.dict(exclude_none=True),
            json=True,
            timeout=60,
        )

        launch_response = CursorAgentLaunchResponse.validate(api_response.json)

        return CodingAgentState(
            id=launch_response.id,
            status=CodingAgentStatus.RUNNING,
            provider=CodingAgentProviderType.CURSOR_BACKGROUND_AGENT,
            name=f"{request.repository.owner}/{request.repository.name}: {launch_response.name or f'Cursor Agent {launch_response.id}'}",
            started_at=launch_response.createdAt,
            agent_url=launch_response.target.url,
        )

    def launch(self, webhook_url: str, request: CodingAgentLaunchRequest) -> CodingAgentState:
        """Launch coding agent with webhook callback.

        Attempts launch with auto model selection first. On retryable failure,
        fetches available models and retries with each model up to MAX_MODEL_RETRIES.
        """
        payload = CursorAgentLaunchRequestBody(
            prompt=CursorAgentLaunchRequestPrompt(
                text=request.prompt,
            ),
            source=CursorAgentSource(
                repository=f"https://github.com/{request.repository.owner}/{request.repository.name}",
                # Use None for empty branch_name so Cursor uses repo's default branch
                ref=request.repository.branch_name or None,
            ),
            webhook=CursorAgentLaunchRequestWebhook(url=webhook_url, secret=self.webhook_secret),
            target=CursorAgentLaunchRequestTarget(
                autoCreatePr=request.auto_create_pr,
                branchName=request.branch_name,
                openAsCursorGithubApp=True,
            ),
        )

        logger.info(
            "coding_agent.cursor.launch",
            extra={
                "webhook_url": webhook_url,
                "agent_type": self.__class__.__name__,
            },
        )

        # First attempt with auto model selection (model=None)
        initial_error: ApiError | None = None
        try:
            return self._post_launch(payload, request)
        except NON_RETRYABLE_ERRORS:
            raise
        except ApiError as e:
            initial_error = e
            logger.warning(
                "coding_agent.cursor.launch_failed_will_retry",
                extra={
                    "error": str(e),
                    "status_code": e.code,
                },
            )

        # Fetch available models for retry
        try:
            models = self.get_available_models()
        except Exception:
            logger.exception("coding_agent.cursor.get_models_failed")
            raise initial_error

        if not models:
            logger.warning("coding_agent.cursor.no_models_available")
            raise initial_error

        # Retry with each model up to MAX_MODEL_RETRIES
        last_error: ApiError = initial_error
        for model in models[:MAX_MODEL_RETRIES]:
            try:
                logger.info(
                    "coding_agent.cursor.retry_with_model",
                    extra={"model": model},
                )
                payload.model = model
                return self._post_launch(payload, request)
            except NON_RETRYABLE_ERRORS:
                raise
            except ApiError as e:
                last_error = e
                logger.warning(
                    "coding_agent.cursor.retry_failed",
                    extra={
                        "model": model,
                        "error": str(e),
                        "status_code": e.code,
                    },
                )

        raise last_error
