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


MAX_SNAPSHOTS_PER_DASHBOARD = 10


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

    Enforces a cap of ``MAX_SNAPSHOTS_PER_DASHBOARD`` per dashboard,
    deleting the oldest snapshots first when the limit is reached.
    """
    snapshot_data = serialize(dashboard)
    history = DashboardHistory.objects.create(
        dashboard=dashboard,
        organization=dashboard.organization,
        created_by_id=user_id,
        title=dashboard.title,
        source=source,
        snapshot=snapshot_data,
    )

    # Delete oldest snapshots exceeding the cap
    ids_to_keep = list(
        DashboardHistory.objects.filter(dashboard=dashboard)
        .order_by("-date_added")
        .values_list("id", flat=True)[:MAX_SNAPSHOTS_PER_DASHBOARD]
    )
    DashboardHistory.objects.filter(dashboard=dashboard).exclude(id__in=ids_to_keep).delete()

    return history


# Read-only / computed fields to strip at each level so the serializer
# treats the snapshot as fresh input.  Using a blocklist instead of an
# allowlist means new schema fields pass through automatically.
_DASHBOARD_EXCLUDE = {"id", "dateCreated", "createdBy", "isFavorited", "prebuiltId"}
_WIDGET_EXCLUDE = {"id", "dateCreated", "dashboardId", "exploreUrls", "changedReason"}
_QUERY_EXCLUDE = {"id", "widgetId", "onDemand"}


def _snapshot_to_input_format(snapshot: dict[str, Any]) -> dict[str, Any]:
    """
    Transform a snapshot (API response format, camelCase) into the
    shape accepted by ``DashboardDetailsSerializer`` for an update.

    Strips read-only / server-computed fields and widget/query IDs so
    the serializer treats every widget as a *new* creation (rather than
    trying to update by ID — those widgets may no longer exist).
    """
    widgets = []
    for w in snapshot.get("widgets", []):
        queries = [
            {k: v for k, v in q.items() if k not in _QUERY_EXCLUDE} for q in w.get("queries", [])
        ]
        widget_data = {k: v for k, v in w.items() if k not in _WIDGET_EXCLUDE and k != "queries"}
        widget_data["queries"] = queries
        widgets.append(widget_data)

    result = {k: v for k, v in snapshot.items() if k not in _DASHBOARD_EXCLUDE and k != "widgets"}
    result["widgets"] = widgets
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
