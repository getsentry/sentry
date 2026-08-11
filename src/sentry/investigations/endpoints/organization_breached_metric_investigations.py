from __future__ import annotations

from typing import Any

from django.db import IntegrityError, router, transaction
from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.serializers import serialize
from sentry.investigations.endpoints.base import (
    accessible_project_ids,
    require_authenticated_user,
    require_breached_metric_feature,
    serialize_permissions,
)
from sentry.investigations.endpoints.serializers import InvestigationDetailsSerializer
from sentry.investigations.models import Investigation, InvestigationStatus
from sentry.investigations.permissions import InvestigationPermission
from sentry.investigations.services import create_template_investigation
from sentry.investigations.services.auto_run import schedule_eligible_auto_run_blocks
from sentry.investigations.services.breached_metrics import resolve_breached_metric_sources
from sentry.models.organization import Organization


def _parse_group_ids(value: Any) -> list[int] | None:
    if not isinstance(value, list) or not 1 <= len(value) <= 100:
        return None
    parsed: list[int] = []
    for item in value:
        if isinstance(item, bool) or not isinstance(item, int | str):
            return None
        try:
            parsed.append(int(item))
        except (TypeError, ValueError):
            return None
    return list(dict.fromkeys(parsed))


def _serialize_investigation(
    investigation: Investigation,
    request: Request,
    organization: Organization,
    project_ids: set[int],
) -> dict[str, Any]:
    data = dict(
        serialize(
            investigation,
            request.user,
            InvestigationDetailsSerializer(accessible_project_ids=project_ids),
        )
    )
    data["permissions"] = serialize_permissions(investigation, request, organization)
    return data


@extend_schema(tags=["Investigations"])
@cell_silo_endpoint
class OrganizationBreachedMetricInvestigationStatusEndpoint(OrganizationEndpoint):
    owner = ApiOwner.ML_AI
    permission_classes = (InvestigationPermission,)
    publish_status = {"POST": ApiPublishStatus.PRIVATE}

    def post(self, request: Request, organization: Organization) -> Response:
        require_breached_metric_feature(request, organization)
        group_ids = _parse_group_ids(request.data.get("groupIds"))
        if group_ids is None:
            return Response(
                {"detail": "groupIds must contain between 1 and 100 issue IDs."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        sources = resolve_breached_metric_sources(
            organization=organization,
            group_ids=group_ids,
            accessible_project_ids=accessible_project_ids(self, request, organization),
        )
        existing = {
            investigation.source_key: investigation
            for investigation in Investigation.objects.filter(
                organization=organization,
                source_type="breached_metric",
                source_key__in=[source.source_key for source in sources.values()],
                status=InvestigationStatus.ACTIVE,
            ).order_by("source_key", "source_revision")
        }
        can_create = request.user.is_authenticated and not request.user.is_sentry_app
        items: dict[str, dict[str, str]] = {}
        for group_id in group_ids:
            source = sources.get(group_id)
            if source is None:
                items[str(group_id)] = {"status": "unavailable"}
                continue
            investigation = existing.get(source.source_key)
            if investigation is not None:
                items[str(group_id)] = {
                    "status": "view",
                    "investigationId": str(investigation.id),
                    "openPeriodId": str(source.open_period.id),
                }
                continue
            if not can_create:
                items[str(group_id)] = {"status": "unavailable"}
                continue
            items[str(group_id)] = {
                "status": "investigate",
                "openPeriodId": str(source.open_period.id),
            }
        return Response({"items": items})


@extend_schema(tags=["Investigations"])
@cell_silo_endpoint
class OrganizationBreachedMetricInvestigationLaunchEndpoint(OrganizationEndpoint):
    owner = ApiOwner.ML_AI
    permission_classes = (InvestigationPermission,)
    publish_status = {"POST": ApiPublishStatus.PRIVATE}

    def post(self, request: Request, organization: Organization) -> Response:
        actor_id = require_authenticated_user(request)
        require_breached_metric_feature(request, organization)
        group_ids = _parse_group_ids([request.data.get("groupId")])
        open_period_ids = _parse_group_ids([request.data.get("openPeriodId")])
        if group_ids is None or open_period_ids is None:
            return Response(
                {"detail": "groupId and openPeriodId must be issue IDs."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        group_id = group_ids[0]
        open_period_id = open_period_ids[0]
        project_ids = accessible_project_ids(self, request, organization)
        source = resolve_breached_metric_sources(
            organization=organization,
            group_ids=[group_id],
            accessible_project_ids=project_ids,
        ).get(group_id)
        if source is None or source.open_period.id != open_period_id:
            raise ResourceDoesNotExist

        created = False
        database = router.db_for_write(Investigation)
        try:
            with transaction.atomic(using=database):
                investigation = (
                    Investigation.objects.select_for_update()
                    .filter(
                        organization=organization,
                        source_type="breached_metric",
                        source_key=source.source_key,
                        status=InvestigationStatus.ACTIVE,
                    )
                    .first()
                )
                if investigation is None:
                    investigation = create_template_investigation(
                        organization=organization,
                        user_id=actor_id,
                        template_key="breached_metric",
                        template_version=1,
                        source_ref={
                            "groupId": str(group_id),
                            "openPeriodId": str(open_period_id),
                        },
                        supplied_parameters={},
                        accessible_project_ids=project_ids,
                    )
                    created = True
                    schedule_eligible_auto_run_blocks(
                        investigation_id=investigation.id,
                        user_id=actor_id,
                    )
        except IntegrityError:
            investigation = Investigation.objects.get(
                organization=organization,
                source_type="breached_metric",
                source_key=source.source_key,
                status=InvestigationStatus.ACTIVE,
            )
            created = False
        if created:
            investigation.refresh_from_db()
        return Response(
            _serialize_investigation(
                investigation,
                request,
                organization,
                project_ids,
            ),
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )
