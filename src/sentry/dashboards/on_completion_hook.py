from __future__ import annotations

import logging

from pydantic import ValidationError

from sentry.dashboards.models.generate_dashboard_artifact import GeneratedDashboard
from sentry.models.organization import Organization
from sentry.seer.explorer.client import SeerExplorerClient
from sentry.seer.explorer.client_utils import fetch_run_status
from sentry.seer.explorer.on_completion_hook import ExplorerOnCompletionHook

logger = logging.getLogger(__name__)

FIX_PROMPT = "The generated dashboard artifact has validation errors."
FIX_PROMPT_SECONDARY = "Please fix the following issues and regenerate the dashboard artifact:"

MAX_VALIDATION_RETRIES = 3


class DashboardOnCompletionHook(ExplorerOnCompletionHook):
    """
    Hook called when a dashboard generation Explorer run completes.

    Validates the generated dashboard artifact against the GeneratedDashboard
    Pydantic model. If validation fails (e.g. blocklisted functions), asks Seer
    to regenerate with the error details.

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
                "dashboards.on_completion_hook.validation_failed",
                extra={
                    "run_id": run_id,
                    "organization_id": organization.id,
                },
            )

            # Count consecutive fix requests in the current failure chain by
            # scanning blocks in reverse. A non-fix user message (i.e. the user
            # explicitly continuing the conversation) breaks the chain so each
            # new user-driven generation gets its own retry budget.
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
                        "run_id": run_id,
                        "organization_id": organization.id,
                        "retry_count": retry_count,
                    },
                )
                return

            cls._request_fix(organization, run_id, validation_error)
            return

        if artifact is None:
            logger.warning(
                "dashboards.on_completion_hook.no_artifact",
                extra={"run_id": run_id, "organization_id": organization.id},
            )
            return

        logger.info(
            "dashboards.on_completion_hook.validation_passed",
            extra={"run_id": run_id, "organization_id": organization.id},
        )

    @classmethod
    def _request_fix(cls, organization: Organization, run_id: int, error: ValidationError) -> None:
        try:
            client = SeerExplorerClient(organization=organization, user=None)
            # We only request a single regeneration. No further generation requests are made if this fails.
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
