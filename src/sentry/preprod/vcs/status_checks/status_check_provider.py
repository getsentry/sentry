import logging
from abc import ABC, abstractmethod
from datetime import datetime
from typing import Any

from sentry.integrations.github.status_check import GitHubCheckConclusion, GitHubCheckStatus
from sentry.integrations.source_code_management.metrics import (
    SCMIntegrationInteractionEvent,
    SCMIntegrationInteractionType,
)
from sentry.integrations.source_code_management.status_check import (
    StatusCheckClient,
    StatusCheckStatus,
)
from sentry.shared_integrations.exceptions import (
    ApiError,
    ApiForbiddenError,
    ApiRateLimitedError,
    IntegrationConfigurationError,
)

logger = logging.getLogger(__name__)


GITHUB_STATUS_CHECK_STATUS_MAPPING: dict[StatusCheckStatus, GitHubCheckStatus] = {
    StatusCheckStatus.ACTION_REQUIRED: GitHubCheckStatus.COMPLETED,
    StatusCheckStatus.IN_PROGRESS: GitHubCheckStatus.IN_PROGRESS,
    StatusCheckStatus.FAILURE: GitHubCheckStatus.COMPLETED,
    StatusCheckStatus.NEUTRAL: GitHubCheckStatus.COMPLETED,
    StatusCheckStatus.SUCCESS: GitHubCheckStatus.COMPLETED,
}

GITHUB_STATUS_CHECK_CONCLUSION_MAPPING: dict[StatusCheckStatus, GitHubCheckConclusion | None] = {
    StatusCheckStatus.ACTION_REQUIRED: GitHubCheckConclusion.ACTION_REQUIRED,
    StatusCheckStatus.IN_PROGRESS: None,
    StatusCheckStatus.FAILURE: GitHubCheckConclusion.FAILURE,
    StatusCheckStatus.NEUTRAL: GitHubCheckConclusion.NEUTRAL,
    StatusCheckStatus.SUCCESS: GitHubCheckConclusion.SUCCESS,
}


class StatusCheckProvider(ABC):
    """
    The APIs for creating status checks are slightly different for each provider.
    This provides a common interface for creating status checks.
    """

    def __init__(
        self,
        client: StatusCheckClient,
        provider_key: str,
        organization_id: int,
        organization_slug: str,
        integration_id: int,
    ):
        self.client = client
        self.provider_key = provider_key
        self.organization_id = organization_id
        self.organization_slug = organization_slug
        self.integration_id = integration_id

    def _create_scm_interaction_event(self) -> SCMIntegrationInteractionEvent:
        return SCMIntegrationInteractionEvent(
            interaction_type=SCMIntegrationInteractionType.CREATE_STATUS_CHECK,
            provider_key=self.provider_key,
            organization_id=self.organization_id,
            integration_id=self.integration_id,
        )

    @abstractmethod
    def create_status_check(
        self,
        repo: str,
        sha: str,
        status: StatusCheckStatus,
        title: str,
        subtitle: str,
        text: str | None,
        summary: str,
        external_id: str,
        started_at: datetime,
        completed_at: datetime | None = None,
        target_url: str | None = None,
        approve_action_identifier: str | None = None,
    ) -> str | None:
        """Create a status check using provider-specific format."""
        raise NotImplementedError


class GitHubStatusCheckProvider(StatusCheckProvider):
    def create_status_check(
        self,
        repo: str,
        sha: str,
        status: StatusCheckStatus,
        title: str,
        subtitle: str,
        text: str | None,
        summary: str,
        external_id: str,
        started_at: datetime,
        completed_at: datetime | None = None,
        target_url: str | None = None,
        approve_action_identifier: str | None = None,
    ) -> str | None:
        with self._create_scm_interaction_event().capture() as lifecycle:
            mapped_status = GITHUB_STATUS_CHECK_STATUS_MAPPING.get(status)
            mapped_conclusion = GITHUB_STATUS_CHECK_CONCLUSION_MAPPING.get(status)

            if not mapped_status:
                logger.error(
                    "preprod.status_checks.create.invalid_status_mapping",
                    extra={"status": status},
                )
                return None

            truncated_text = _truncate_to_byte_limit(text, GITHUB_MAX_TEXT_FIELD_LENGTH)
            truncated_summary = _truncate_to_byte_limit(summary, GITHUB_MAX_SUMMARY_FIELD_LENGTH)

            if text and truncated_text and len(truncated_text) != len(text):
                logger.warning(
                    "preprod.status_checks.create.text_truncated",
                    extra={
                        "original_bytes": len(text.encode("utf-8")),
                        "truncated_bytes": len(truncated_text.encode("utf-8")),
                        "organization_id": self.organization_id,
                        "organization_slug": self.organization_slug,
                    },
                )

            if summary and truncated_summary and len(truncated_summary) != len(summary):
                logger.warning(
                    "preprod.status_checks.create.summary_truncated",
                    extra={
                        "original_bytes": len(summary.encode("utf-8")),
                        "truncated_bytes": len(truncated_summary.encode("utf-8")),
                        "organization_id": self.organization_id,
                        "organization_slug": self.organization_slug,
                    },
                )

            check_data: dict[str, Any] = {
                "name": title,
                "head_sha": sha,
                "external_id": external_id,
                "output": {
                    "title": subtitle,
                    "summary": truncated_summary,
                },
                "status": mapped_status.value,
            }

            if truncated_text:
                check_data["output"]["text"] = truncated_text

            if mapped_conclusion:
                check_data["conclusion"] = mapped_conclusion.value

            if started_at:
                check_data["started_at"] = started_at.isoformat()

            if completed_at:
                check_data["completed_at"] = completed_at.isoformat()

            if target_url:
                if target_url.startswith("http"):
                    check_data["details_url"] = target_url
                else:
                    logger.warning(
                        "preprod.status_checks.create.invalid_target_url",
                        extra={"target_url": target_url},
                    )

            # GitHub rejects completed_at=null when status is "completed" with a 422
            if mapped_status == GitHubCheckStatus.COMPLETED and completed_at is None:
                raise ValueError(
                    "GitHub API rejects completed_at=null when status is 'completed'. "
                    "Omit completed_at entirely instead of setting it to None."
                )

            if approve_action_identifier:
                check_data["actions"] = [
                    {
                        "label": "Approve",
                        "description": "Approve changes for this PR",
                        "identifier": approve_action_identifier,
                    }
                ]

            try:
                response = self.client.create_check_run(repo=repo, data=check_data)
                check_id = response.get("id")
                return str(check_id) if check_id else None
            except ApiForbiddenError as e:
                lifecycle.record_halt(e)
                error_message = str(e).lower()
                if "rate limit exceeded" in error_message:
                    raise ApiRateLimitedError("GitHub rate limit exceeded") from e
                if (
                    "resource not accessible" in error_message
                    or "insufficient" in error_message
                    or "permission" in error_message
                ):
                    logger.warning(
                        "preprod.status_checks.create.insufficient_permissions",
                        extra={
                            "organization_id": self.organization_id,
                            "integration_id": self.integration_id,
                            "repo": repo,
                            "error_message": str(e),
                        },
                    )
                    raise IntegrationConfigurationError(
                        "GitHub App lacks permissions to create check runs. "
                        "Please ensure the app has the required permissions and that "
                        "the organization has accepted any updated permissions."
                    ) from e
                raise
            except ApiRateLimitedError as e:
                lifecycle.record_halt(e)
                raise
            except ApiError as e:
                lifecycle.record_halt(e)
                # 403s are handled by ApiForbiddenError above
                # 4xx errors are typically user/config issues, not bugs
                if e.code and 400 <= e.code < 500 and e.code not in (403, 429):
                    logger.warning(
                        "preprod.status_checks.create.client_error",
                        extra={
                            "organization_id": self.organization_id,
                            "integration_id": self.integration_id,
                            "repo": repo,
                            "status_code": e.code,
                        },
                    )
                    raise IntegrationConfigurationError(
                        f"GitHub API returned {e.code} client error when creating check run"
                    ) from e
                raise


# See: https://docs.github.com/en/rest/checks/runs?apiVersion=2022-11-28#create-a-check-run
GITHUB_MAX_SUMMARY_FIELD_LENGTH = 65535
GITHUB_MAX_TEXT_FIELD_LENGTH = 65535


def _truncate_to_byte_limit(text: str | None, byte_limit: int) -> str | None:
    """Truncate text to fit within byte limit while ensuring valid UTF-8."""
    if not text:
        return text

    TRUNCATE_AMOUNT = 10

    encoded = text.encode("utf-8")
    if len(encoded) <= byte_limit:
        return text

    if byte_limit <= TRUNCATE_AMOUNT:
        # This shouldn't happen, but just in case.
        truncated = encoded[:byte_limit].decode("utf-8", errors="ignore")
        return truncated

    # Truncate to byte_limit - 10 (a bit of wiggle room) to make room for "..."
    # Note: this can break formatting you have and is more of a catch-all,
    # broken formatting is better than silently erroring for the user.
    # Templating logic itself should try to more contextually trim the content if possible.
    truncated = encoded[: byte_limit - TRUNCATE_AMOUNT].decode("utf-8", errors="ignore")
    return truncated + "..."
