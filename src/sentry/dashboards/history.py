from __future__ import annotations

import logging
from typing import Any

from django.db import router, transaction

from sentry.api.serializers import serialize
from sentry.api.serializers.rest_framework.dashboard import DashboardDetailsSerializer
from sentry.models.dashboard import Dashboard
from sentry.models.dashboard_history import DashboardHistory, DashboardHistorySource
from sentry.models.organization import Organization

logger = logging.getLogger(__name__)


def capture_dashboard_snapshot(
    dashboard: Dashboard,
    user_id: int | None = None,
    source: str = DashboardHistorySource.EDIT,
) -> DashboardHistory:
    """
    Serialize the current dashboard state and persist it as a
    `DashboardHistory` record.  Should be called **before** an
    edit is saved so that the snapshot represents the pre-edit
    state.

    *source* indicates why the snapshot was taken — ``"edit"`` for
    normal edits, ``"restore"`` when capturing state before a
    restore operation.
    """
    snapshot_data = serialize(dashboard)
    return DashboardHistory.objects.create(
        dashboard=dashboard,
        organization=dashboard.organization,
        created_by_id=user_id,
        title=dashboard.title,
        source=source,
        snapshot=snapshot_data,
    )


def _snapshot_to_input_format(snapshot: dict[str, Any]) -> dict[str, Any]:
    """
    Transform a snapshot (API response format, camelCase) into the
    shape accepted by ``DashboardDetailsSerializer`` for an update.

    The key transformation is stripping widget and query IDs so the
    serializer treats every widget as a *new* creation (rather than
    trying to update by ID — those widgets may no longer exist).
    """
    widgets = []
    for w in snapshot.get("widgets", []):
        queries = []
        for q in w.get("queries", []):
            queries.append(
                {
                    "name": q.get("name", ""),
                    "fields": q.get("fields", []),
                    "aggregates": q.get("aggregates", []),
                    "columns": q.get("columns", []),
                    "fieldAliases": q.get("fieldAliases", []),
                    "conditions": q.get("conditions", ""),
                    "orderby": q.get("orderby", ""),
                    "isHidden": q.get("isHidden", False),
                    "selectedAggregate": q.get("selectedAggregate"),
                    "linkedDashboards": q.get("linkedDashboards", []),
                }
            )
        widget_data: dict[str, Any] = {
            "title": w.get("title", ""),
            "description": w.get("description"),
            "displayType": w.get("displayType", "line"),
            "interval": w.get("interval", "5m"),
            "widgetType": w.get("widgetType", "error-events"),
            "queries": queries,
            "limit": w.get("limit"),
            "layout": w.get("layout"),
            "thresholds": w.get("thresholds"),
        }
        if w.get("datasetSource"):
            widget_data["datasetSource"] = w["datasetSource"]
        widgets.append(widget_data)

    result: dict[str, Any] = {
        "title": snapshot.get("title", ""),
        "widgets": widgets,
    }

    if snapshot.get("projects"):
        result["projects"] = snapshot["projects"]
    if snapshot.get("environment") is not None:
        result["environment"] = snapshot["environment"]
    if snapshot.get("period") is not None:
        result["period"] = snapshot["period"]
    if snapshot.get("start") is not None:
        result["start"] = snapshot["start"]
    if snapshot.get("end") is not None:
        result["end"] = snapshot["end"]
    if snapshot.get("utc") is not None:
        result["utc"] = snapshot["utc"]
    if snapshot.get("filters"):
        result["filters"] = snapshot["filters"]
    if snapshot.get("permissions") is not None:
        result["permissions"] = snapshot["permissions"]

    return result


def restore_dashboard_from_snapshot(
    dashboard: Dashboard,
    snapshot: dict[str, Any],
    organization: Organization,
    request: Any,
) -> Dashboard:
    """
    Apply a previously captured snapshot back to *dashboard* using
    ``DashboardDetailsSerializer.update()`` so all widget CRUD is
    handled by the existing serializer logic.
    """
    input_data = _snapshot_to_input_format(snapshot)

    serializer = DashboardDetailsSerializer(
        data=input_data,
        instance=dashboard,
        context={
            "organization": organization,
            "request": request,
            "projects": list(organization.project_set.all()),
            "environment": [],
        },
    )
    serializer.is_valid(raise_exception=True)

    with transaction.atomic(router.db_for_write(Dashboard)):
        serializer.save()

    return serializer.instance
