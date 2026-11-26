from __future__ import annotations

import logging
from types import SimpleNamespace
from typing import Any

import sentry_sdk
from pydantic import ValidationError

from sentry.api.client import ApiClient, ApiError
from sentry.api.serializers.rest_framework import DashboardSerializer
from sentry.constants import ALL_ACCESS_PROJECT_ID, ObjectStatus
from sentry.dashboards.models.generate_dashboard_artifact import (
    GeneratedDashboard,
    GeneratedWidget,
    GeneratedWidgetQuery,
)
from sentry.models.apikey import ApiKey
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.seer.agent.client import SeerAgentClient
from sentry.seer.agent.client_utils import fetch_run_status
from sentry.seer.agent.on_completion_hook import AgentOnCompletionHook
from sentry.snuba.referrer import Referrer

logger = logging.getLogger(__name__)

FIX_PROMPT = "The generated dashboard artifact has validation errors."
FIX_PROMPT_SECONDARY = "Please fix the following issues and regenerate the dashboard artifact:"

MAX_VALIDATION_RETRIES = 3

# The dashboard page's default period, so the dry run sends what the UI sends.
DRY_RUN_STATS_PERIOD = "24h"
DRY_RUN_INTERVAL = "1h"
DRY_RUN_API_KEY_SCOPES = ["org:read", "project:read", "event:read"]

# Datasets the frontend queries for each widget type. Issue widgets query the issues endpoint.
WIDGET_TYPE_DATASETS: dict[str, str] = {
    "error-events": "errors",
    "spans": "spans",
    "logs": "logs",
    "tracemetrics": "tracemetrics",
}

# Mirrors usesTimeSeriesData in static/app/views/dashboards/utils.tsx: chart widgets
# query events-timeseries, and table-style widgets query events.
TIMESERIES_DISPLAY_TYPES = frozenset({"line", "area", "bar"})
TABLE_DISPLAY_TYPES = frozenset({"table", "big_number", "categorical_bar"})


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
    project = Project.objects.filter(organization=organization, status=ObjectStatus.ACTIVE).first()  # noqa: S035

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


def _build_events_request(
    widget: GeneratedWidget, query: GeneratedWidgetQuery, dataset: str
) -> tuple[str, dict[str, Any]] | None:
    """
    Build the events or events-timeseries request the frontend sends for one widget query.
    Returns None for display types the dry run does not cover, such as heatmaps.
    """
    params: dict[str, Any] = {"dataset": dataset, "query": query.conditions}
    if dataset == "spans":
        params["sampling"] = "NORMAL"

    if widget.display_type in TABLE_DISPLAY_TYPES:
        params["field"] = [*query.columns, *query.aggregates]
        params["per_page"] = 1
        if query.orderby:
            params["sort"] = query.orderby
        return "events", params

    if widget.display_type in TIMESERIES_DISPLAY_TYPES:
        params["yAxis"] = query.aggregates
        params["interval"] = DRY_RUN_INTERVAL
        if query.columns:
            fields = [*query.columns, *query.aggregates]
            params["field"] = fields
            params["groupBy"] = fields
            params["topEvents"] = widget.limit
        if query.orderby:
            params["sort"] = query.orderby
        return "events-timeseries", params

    return None


def _build_widget_request(
    widget: GeneratedWidget, query: GeneratedWidgetQuery
) -> tuple[str, dict[str, Any]] | None:
    if widget.widget_type == "issue":
        # Issue charts only take count(new_issues) and count(resolved_issues), which
        # Pydantic already checks, so only the search conditions can still fail.
        params: dict[str, Any] = {"query": query.conditions, "limit": 1}
        if widget.display_type == "table" and query.orderby:
            params["sort"] = query.orderby
        return "issues", params

    dataset = WIDGET_TYPE_DATASETS.get(widget.widget_type or "")
    if dataset is None:
        return None
    return _build_events_request(widget, query, dataset)


def _dry_run_widget_queries(artifact: GeneratedDashboard, organization: Organization) -> list[str]:
    """
    Run each widget query against the endpoint the dashboard page uses for it, and
    return one line per query the endpoint rejects with a 400.

    The serializer checks syntax and field names, but some queries only fail when
    they run, such as numeric tag aggregates on the errors dataset, or aggregates
    in a group-by. Failures other than a 400 are logged and skipped: they do not
    mean that the query is wrong.
    """
    api_key = ApiKey(organization_id=organization.id, scope_list=DRY_RUN_API_KEY_SCOPES)
    shared_params: dict[str, Any] = {
        "project": artifact.projects or [ALL_ACCESS_PROJECT_ID],
        "statsPeriod": DRY_RUN_STATS_PERIOD,
        "referrer": Referrer.API_DASHBOARDS_GENERATE_DRY_RUN.value,
    }
    if artifact.environment:
        shared_params["environment"] = artifact.environment

    errors: list[str] = []
    for widget_idx, widget in enumerate(artifact.widgets):
        for query_idx, query in enumerate(widget.queries):
            request = _build_widget_request(widget, query)
            if request is None:
                continue
            endpoint, params = request
            try:
                ApiClient().get(
                    auth=api_key,
                    user=None,
                    path=f"/organizations/{organization.slug}/{endpoint}/",
                    params={**shared_params, **params},
                )
            except ApiError as error:
                if error.status_code != 400:
                    logger.warning(
                        "dashboards.on_completion_hook.dry_run_request_failed",
                        extra={
                            "organization_id": organization.id,
                            "endpoint": endpoint,
                            "status_code": error.status_code,
                        },
                    )
                    continue
                detail = error.body.get("detail") if isinstance(error.body, dict) else None
                errors.append(
                    f"Widget {widget_idx} ({widget.title!r}), query {query_idx}: "
                    f"{detail if detail is not None else error.body}"
                )
    return errors


class DashboardOnCompletionHook(AgentOnCompletionHook):
    """
    Hook called when a dashboard generation agent run completes.

    Validates the generated dashboard artifact first against the
    GeneratedDashboard Pydantic model (schema-level: blocklisted functions,
    field types, layout constraints), then against the DRF DashboardSerializer
    (semantic-level: search syntax, aggregate/column validity, dataset
    compatibility), then by running each widget query. If any of these fail,
    asks Seer to regenerate with the error details.

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

        query_errors = _dry_run_widget_queries(artifact, organization)
        if query_errors:
            logger.info(
                "dashboards.on_completion_hook.query_dry_run_failed",
                extra={
                    "run_id": run_id,
                    "organization_id": organization.id,
                    "errors": query_errors,
                },
            )

            if retry_count < MAX_VALIDATION_RETRIES:
                cls._request_fix(organization, run_id, "\n".join(query_errors))
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
                    last_layer="query",
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
