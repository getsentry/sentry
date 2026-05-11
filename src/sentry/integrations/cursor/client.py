from __future__ import annotations

import logging
import re

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

_MODEL_NAME_PATTERN = re.compile(r"Model '([^']+)'")
_MODEL_FAMILY_PATTERN = re.compile(r"^([a-zA-Z]+(?:-[a-zA-Z]+)*)-?\d")


def _extract_failed_model_from_error(error: ApiError) -> str | None:
    """Extract the model name from a Cursor API 'Model not available' error."""
    try:
        error_json = error.json
        if error_json is None:
            return None
        message = error_json["error"]
        match = _MODEL_NAME_PATTERN.search(message)
    except (AttributeError, KeyError, TypeError) as e:
        logger.warning(
            "coding_agent.cursor.extract_model_from_error_failed", extra={"error": str(e)}
        )
        return None
    return match.group(1) if match else None


def _get_model_family(model_name: str) -> str:
    """Extract the alphabetic family prefix from a model name.

    Examples: 'gpt-4' -> 'gpt', 'claude-4.6-opus-high-thinking' -> 'claude'
    """
    match = _MODEL_FAMILY_PATTERN.match(model_name)
    return match.group(1).lower() if match else model_name.lower()


def _prioritize_models_by_family(models: list[str], failed_model: str | None) -> list[str]:
    """Reorder models so same-family models come first, then GPT models, then the rest."""
    if failed_model is None:
        return models
    family = _get_model_family(failed_model)
    same_family = [m for m in models if _get_model_family(m) == family]
    gpt_fallback = [
        m for m in models if _get_model_family(m) != family and _get_model_family(m) == "gpt"
    ]
    other = [m for m in models if _get_model_family(m) != family and _get_model_family(m) != "gpt"]
    return same_family + gpt_fallback + other


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

    def verify_api_key(self) -> CursorApiKeyMetadata | None:
        """Verify the API key and optionally fetch metadata.

        Tries /v0/me first to get user metadata (apiKeyName, userEmail).
        Falls back to /v0/models if /v0/me fails, since /v0/me doesn't work
        with Cursor service accounts. Returns None when falling back.
        """
        logger.info(
            "coding_agent.cursor.verify_api_key",
            extra={"agent_type": self.__class__.__name__},
        )

        try:
            api_response = self.get(
                "/v0/me",
                headers={
                    "content-type": "application/json;charset=utf-8",
                    **self._get_auth_headers(),
                },
                timeout=30,
            )
            metadata = CursorApiKeyMetadata.validate(api_response.json)
            logger.info("coding_agent.cursor.verify_api_key.v0_me_success")
            return metadata
        except Exception:
            logger.warning("coding_agent.cursor.verify_api_key.v0_me_failed_trying_models")

        # Fall back to /v0/models for service accounts
        self.get(
            "/v0/models",
            headers={
                "content-type": "application/json;charset=utf-8",
                **self._get_auth_headers(),
            },
            timeout=30,
        )
        logger.info("coding_agent.cursor.verify_api_key.v0_models_fallback_success")
        return None

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
        fetches available models and retries once with the first prioritized model.
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

        # For 4xx errors, only retry if the error is specifically about an unavailable model.
        # Other 4xx errors (invalid branch name, bad prompt, etc.) won't be fixed by switching models.
        failed_model = _extract_failed_model_from_error(initial_error)
        if initial_error.code is not None and 400 <= initial_error.code < 500 and not failed_model:
            raise initial_error

        models = _prioritize_models_by_family(models, failed_model)

        model = models[0]
        logger.info("coding_agent.cursor.retry_with_model", extra={"model": model})
        payload.model = model
        try:
            return self._post_launch(payload, request)
        except ApiError as e:
            logger.warning(
                "coding_agent.cursor.retry_failed",
                extra={
                    "model": model,
                    "error": str(e),
                    "status_code": e.code,
                },
            )
            raise
