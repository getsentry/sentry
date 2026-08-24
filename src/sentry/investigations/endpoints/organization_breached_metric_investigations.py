from __future__ import annotations

from django.db import IntegrityError, router, transaction
from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.serializers import serialize
from sentry.investigations.endpoints.base import (
    OrganizationInvestigationsBaseEndpoint,
    require_authenticated_user,
)
from sentry.investigations.endpoints.serializers import InvestigationDetailsSerializer
from sentry.investigations.endpoints.validators import (
    BreachedMetricLaunchValidator,
    BreachedMetricStatusValidator,
)
from sentry.investigations.models import Investigation, InvestigationStatus
from sentry.investigations.services import create_template_investigation
from sentry.investigations.services.auto_run import schedule_eligible_auto_run_blocks
from sentry.investigations.services.breached_metrics import resolve_breached_metric_sources
from sentry.models.organization import Organization


@extend_schema(tags=["Investigations"])
@cell_silo_endpoint
class OrganizationBreachedMetricInvestigationStatusEndpoint(OrganizationInvestigationsBaseEndpoint):
    publish_status = {"POST": ApiPublishStatus.PRIVATE}

    def post(self, request: Request, organization: Organization) -> Response:
        validator = BreachedMetricStatusValidator(data=request.data)
        if not validator.is_valid():
            return Response(validator.errors, status=status.HTTP_400_BAD_REQUEST)
        group_ids = validator.validated_data["group_ids"]
        sources = resolve_breached_metric_sources(
            organization=organization,
            group_ids=group_ids,
            accessible_project_ids=request.access.accessible_project_ids,
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
class OrganizationBreachedMetricInvestigationLaunchEndpoint(OrganizationInvestigationsBaseEndpoint):
    publish_status = {"POST": ApiPublishStatus.PRIVATE}

    def post(self, request: Request, organization: Organization) -> Response:
        actor_id = require_authenticated_user(request)
        validator = BreachedMetricLaunchValidator(data=request.data)
        if not validator.is_valid():
            return Response(validator.errors, status=status.HTTP_400_BAD_REQUEST)
        group_id = validator.validated_data["group_id"]
        open_period_id = validator.validated_data["open_period_id"]
        project_ids = request.access.accessible_project_ids
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
            serialize(
                investigation,
                request.user,
                InvestigationDetailsSerializer(accessible_project_ids=project_ids),
            ),
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )
