from __future__ import annotations

import logging
from types import SimpleNamespace
from typing import Any

import sentry_sdk
from pydantic import ValidationError

from sentry.api.serializers.rest_framework import DashboardSerializer
from sentry.constants import ObjectStatus
from sentry.dashboards.models.generate_dashboard_artifact import GeneratedDashboard
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.seer.agent.client import SeerAgentClient
from sentry.seer.agent.client_utils import fetch_run_status
from sentry.seer.agent.on_completion_hook import AgentOnCompletionHook

logger = logging.getLogger(__name__)

FIX_PROMPT = "The generated dashboard artifact has validation errors."
FIX_PROMPT_SECONDARY = "Please fix the following issues and regenerate the dashboard artifact:"

MAX_VALIDATION_RETRIES = 3


def _format_serializer_errors(errors: dict[str, Any]) -> str:
    """
    Flatten DRF's nested error dict into plain-language lines the model can act on.

    Example output:
        Widget 1, title: This field may not be blank.
        Widget 1, query 0, aggregates: Invalid aggregate function 'spm'.
    """
    lines: list[str] = []

    for top_field, top_errors in errors.items():
        if top_field == "widgets" and isinstance(top_errors, list):
            for widget_idx, widget_errors in enumerate(top_errors):
                if not isinstance(widget_errors, dict) or not widget_errors:
                    continue
                for widget_field, widget_field_errors in widget_errors.items():
                    if widget_field == "queries" and isinstance(widget_field_errors, list):
                        for query_idx, query_errors in enumerate(widget_field_errors):
                            if not isinstance(query_errors, dict) or not query_errors:
                                continue
                            for query_field, query_field_errors in query_errors.items():
                                msg = (
                                    ", ".join(str(e) for e in query_field_errors)
                                    if isinstance(query_field_errors, list)
                                    else str(query_field_errors)
                                )
                                lines.append(
                                    f"Widget {widget_idx}, query {query_idx}, {query_field}: {msg}"
                                )
                    else:
                        msg = (
                            ", ".join(str(e) for e in widget_field_errors)
                            if isinstance(widget_field_errors, list)
                            else str(widget_field_errors)
                        )
                        lines.append(f"Widget {widget_idx}, {widget_field}: {msg}")
        else:
            msg = (
                ", ".join(str(e) for e in top_errors)
                if isinstance(top_errors, list)
                else str(top_errors)
            )
            lines.append(f"{top_field}: {msg}")

    return "\n".join(lines) if lines else str(errors)


def _validate_with_serializer(
    artifact: GeneratedDashboard, organization: Organization
) -> dict[str, Any] | None:
    """
    Run the generated dashboard through the DRF DashboardSerializer to catch
    issues the Pydantic model doesn't cover (invalid search syntax, unknown
    aggregates, dataset compatibility, etc.).
    """

    # Projects are unused in this check, but we need at least one project to satisfy the serializer
    project = Project.objects.filter(organization=organization, status=ObjectStatus.ACTIVE).first()

    if project is None:
        return None
    # Strip fields that require request-scoped context (project permissions,
    # environment access) which we don't have in the completion hook.
    # The serializer validation here targets widget-level correctness.
    artifact_data = artifact.dict()
    artifact_data.pop("projects", None)
    artifact_data.pop("environment", None)

    serializer = DashboardSerializer(
        data=artifact_data,
        context={
            "organization": organization,
            "request": SimpleNamespace(user=None),  # mock request to satisfy serializer
            "projects": [project],
            "environment": [],
        },
    )
    if not serializer.is_valid():
        return serializer.errors
    return None


class DashboardOnCompletionHook(AgentOnCompletionHook):
    """
    Hook called when a dashboard generation agent run completes.

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

        retry_count = cls._count_retries(state)

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

            if retry_count < MAX_VALIDATION_RETRIES:
                cls._request_fix(organization, run_id, str(validation_error))
            else:
                logger.info(
                    "dashboards.on_completion_hook.max_retries_reached",
                    extra={
                        "organization_id": organization.id,
                        "run_id": run_id,
                        "retry_count": retry_count,
                    },
                )
                cls._emit_generation_attempts_metric(
                    status="fail",
                    result="max_retries",
                    retry_count=retry_count,
                    last_layer="pydantic",
                )
            return

        if artifact is None:
            logger.warning(
                "dashboards.on_completion_hook.no_artifact",
                extra={"run_id": run_id, "organization_id": organization.id},
            )
            cls._emit_generation_attempts_metric(
                status="fail",
                result="no_artifact",
                retry_count=retry_count,
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

            if retry_count < MAX_VALIDATION_RETRIES:
                cls._request_fix(organization, run_id, _format_serializer_errors(serializer_errors))
            else:
                logger.info(
                    "dashboards.on_completion_hook.max_retries_reached",
                    extra={
                        "organization_id": organization.id,
                        "run_id": run_id,
                        "retry_count": retry_count,
                    },
                )
                cls._emit_generation_attempts_metric(
                    status="fail",
                    result="max_retries",
                    retry_count=retry_count,
                    last_layer="serializer",
                )
            return

        logger.info(
            "dashboards.on_completion_hook.validation_passed",
            extra={"run_id": run_id, "organization_id": organization.id},
        )
        cls._emit_generation_attempts_metric(
            status="pass",
            result="pass",
            retry_count=retry_count,
        )

    @staticmethod
    def _count_retries(state: Any) -> int:
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
        return retry_count

    @staticmethod
    def _emit_generation_attempts_metric(
        status: str,
        result: str,
        retry_count: int,
        last_layer: str | None = None,
    ) -> None:
        attributes = {"status": status, "result": result}
        if last_layer is not None:
            attributes["last_layer"] = last_layer
        sentry_sdk.metrics.distribution(
            "dashboards.on_completion_hook.generation_attempts",
            retry_count + 1,
            attributes=attributes,
        )

    @classmethod
    def _request_fix(cls, organization: Organization, run_id: int, error: str) -> None:
        try:
            client = SeerAgentClient(organization=organization, user=None)
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
