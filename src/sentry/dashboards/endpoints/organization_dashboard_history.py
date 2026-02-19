from __future__ import annotations

from typing import Any

from django.db import router, transaction
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers import serialize
from sentry.dashboards.endpoints.organization_dashboard_details import (
    EDIT_FEATURE,
    READ_FEATURE,
    OrganizationDashboardBase,
)
from sentry.dashboards.history import capture_dashboard_snapshot, restore_dashboard_from_snapshot
from sentry.features import has as feature_has
from sentry.models.dashboard import Dashboard
from sentry.models.dashboard_history import DashboardHistory, DashboardHistorySource
from sentry.models.organization import Organization
from sentry.users.services.user.service import user_service


@region_silo_endpoint
class DashboardHistoryEndpoint(OrganizationDashboardBase):
    owner = ApiOwner.DASHBOARDS
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }

    def get(
        self,
        request: Request,
        organization: Organization,
        dashboard: Dashboard | dict[Any, Any],
    ) -> Response:
        """
        List history entries for a dashboard.
        Returns id, date_added, title, and created_by for each snapshot.
        """
        if not feature_has(READ_FEATURE, organization, actor=request.user):
            return Response(status=404)

        if isinstance(dashboard, dict):
            return Response(status=404)

        queryset = DashboardHistory.objects.filter(
            dashboard=dashboard,
            organization=organization,
        ).order_by("-date_added")

        def serialize_results(results: list[DashboardHistory]) -> list[dict[str, Any]]:
            user_ids = [e.created_by_id for e in results if e.created_by_id is not None]
            users_by_id = {
                u.id: {"id": str(u.id), "name": u.name, "email": u.email}
                for u in user_service.get_many_by_id(ids=user_ids)
            }
            return [
                {
                    "id": str(entry.id),
                    "dateAdded": entry.date_added,
                    "title": entry.title,
                    "createdBy": users_by_id.get(entry.created_by_id)
                    if entry.created_by_id
                    else None,
                    "source": entry.source,
                    "widgetCount": len(entry.snapshot.get("widgets", []) if entry.snapshot else []),
                }
                for entry in results
            ]

        return self.paginate(
            request=request,
            queryset=queryset,
            paginator_cls=OffsetPaginator,
            on_results=serialize_results,
        )


@region_silo_endpoint
class DashboardRestoreEndpoint(OrganizationDashboardBase):
    owner = ApiOwner.DASHBOARDS
    publish_status = {
        "POST": ApiPublishStatus.PRIVATE,
    }

    def convert_args(
        self,
        request: Request,
        organization_id_or_slug: str | int,
        dashboard_id: str | int,
        history_id: str | int,
        *args: Any,
        **kwargs: Any,
    ) -> tuple[tuple[Any, ...], dict[str, Any]]:
        args, kwargs = super().convert_args(
            request, organization_id_or_slug, dashboard_id, *args, **kwargs
        )

        try:
            kwargs["history"] = DashboardHistory.objects.get(
                id=history_id,
                dashboard_id=kwargs["dashboard"].id
                if isinstance(kwargs["dashboard"], Dashboard)
                else None,
                organization=kwargs["organization"],
            )
        except (DashboardHistory.DoesNotExist, ValueError):
            raise ResourceDoesNotExist

        return (args, kwargs)

    def post(
        self,
        request: Request,
        organization: Organization,
        dashboard: Dashboard | dict[Any, Any],
        history: DashboardHistory,
    ) -> Response:
        """
        Restore a dashboard to a previous snapshot.
        Captures current state first so the restore is undoable.
        """
        if not feature_has(EDIT_FEATURE, organization, actor=request.user):
            return Response(status=404)

        if isinstance(dashboard, dict):
            return Response(
                {"detail": "Cannot restore pre-built dashboards."},
                status=400,
            )

        with transaction.atomic(router.db_for_write(Dashboard)):
            capture_dashboard_snapshot(
                dashboard, user_id=request.user.id, source=DashboardHistorySource.RESTORE
            )

            restored = restore_dashboard_from_snapshot(
                dashboard=dashboard,
                snapshot=history.snapshot,
                organization=organization,
                request=request,
            )

        return Response(serialize(restored, request.user), status=200)
