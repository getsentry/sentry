from __future__ import annotations

import logging
from types import SimpleNamespace
from typing import Any

from pydantic import ValidationError

from sentry.api.serializers.rest_framework import DashboardSerializer
from sentry.constants import ObjectStatus
from sentry.dashboards.models.generate_dashboard_artifact import GeneratedDashboard
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.seer.explorer.client import SeerExplorerClient
from sentry.seer.explorer.client_utils import fetch_run_status
from sentry.seer.explorer.on_completion_hook import ExplorerOnCompletionHook

logger = logging.getLogger(__name__)

FIX_PROMPT = "The generated dashboard artifact has validation errors."
FIX_PROMPT_SECONDARY = "Please fix the following issues and regenerate the dashboard artifact:"

MAX_VALIDATION_RETRIES = 3


def _validate_with_serializer(
    artifact: GeneratedDashboard, organization: Organization
) -> dict[str, Any] | None:
    """
    Run the generated dashboard through the DRF DashboardSerializer to catch
    issues the Pydantic model doesn't cover (invalid search syntax, unknown
    aggregates, dataset compatibility, etc.).
    """

    # Projects are unused in this check, but we need at least one project to satisfy the serializer
    projects = [Project.objects.filter(organization=organization, status=ObjectStatus.ACTIVE)[0]]

    serializer = DashboardSerializer(
        data=artifact.dict(),
        context={
            "organization": organization,
            "request": SimpleNamespace(user=None),  # mock request to satisfy serializer
            "projects": projects,
            "environment": [],
        },
    )
    if not serializer.is_valid():
        return serializer.errors
    return None


class DashboardOnCompletionHook(ExplorerOnCompletionHook):
    """
    Hook called when a dashboard generation Explorer run completes.

    Validates the generated dashboard artifact first against the
    GeneratedDashboard Pydantic model (schema-level: blocklisted functions,
    field types, layout constraints), then against the DRF DashboardSerializer
    (semantic-level: search syntax, aggregate/column validity, dataset
    compatibility). If either validation fails, asks Seer to regenerate with
    the error details.

    The hook is limited to MAX_VALIDATION_RETRIES retry attempts to prevent
    infinite loops, since on_completion_hooks persist across continue_run calls.
    """

    @classmethod
    def execute(cls, organization: Organization, run_id: int) -> None:
        try:
            state = fetch_run_status(run_id, organization)
        except Exception:
            logger.exception(
                "dashboards.on_completion_hook.fetch_state_failed",
                extra={"run_id": run_id, "organization_id": organization.id},
            )
            return

        if state.status != "completed":
            return

        try:
            artifact = state.get_artifact("dashboard", GeneratedDashboard)
        except ValidationError as validation_error:
            logger.info(
                "dashboards.on_completion_hook.pydantic_validation_failed",
                extra={
                    "run_id": run_id,
                    "organization_id": organization.id,
                },
            )

            if cls._within_retry_budget(state):
                cls._request_fix(organization, run_id, str(validation_error))
            return

        if artifact is None:
            logger.warning(
                "dashboards.on_completion_hook.no_artifact",
                extra={"run_id": run_id, "organization_id": organization.id},
            )
            return

        serializer_errors = _validate_with_serializer(artifact, organization)
        if serializer_errors is not None:
            logger.info(
                "dashboards.on_completion_hook.serializer_validation_failed",
                extra={
                    "run_id": run_id,
                    "organization_id": organization.id,
                    "errors": serializer_errors,
                },
            )

            if cls._within_retry_budget(state):
                cls._request_fix(organization, run_id, str(serializer_errors))
            return

        logger.info(
            "dashboards.on_completion_hook.validation_passed",
            extra={"run_id": run_id, "organization_id": organization.id},
        )

    @classmethod
    def _within_retry_budget(cls, state: Any) -> bool:
        """
        Count consecutive fix requests in the current failure chain by
        scanning blocks in reverse. A non-fix user message (i.e. the user
        explicitly continuing the conversation) breaks the chain so each
        new user-driven generation gets its own retry budget.
        """
        retry_count = 0
        for block in reversed(state.blocks):
            if (
                block.message.role == "user"
                and block.message.content
                and block.message.content.startswith(FIX_PROMPT)
            ):
                retry_count += 1
            elif block.message.role == "user":
                break

        if retry_count >= MAX_VALIDATION_RETRIES:
            logger.info(
                "dashboards.on_completion_hook.max_retries_reached",
                extra={
                    "retry_count": retry_count,
                },
            )
            return False
        return True

    @classmethod
    def _request_fix(cls, organization: Organization, run_id: int, error: str) -> None:
        try:
            client = SeerExplorerClient(organization=organization, user=None)
            client.continue_run(
                run_id,
                prompt=(f"{FIX_PROMPT} {FIX_PROMPT_SECONDARY}\n\n{error}"),
                artifact_key="dashboard",
                artifact_schema=GeneratedDashboard,
            )
        except Exception:
            logger.exception(
                "dashboards.on_completion_hook.continue_run_failed",
                extra={"run_id": run_id, "organization_id": organization.id},
            )
