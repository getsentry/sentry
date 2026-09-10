from __future__ import annotations

from typing import TypedDict

from drf_spectacular.utils import extend_schema
from rest_framework import serializers
from rest_framework.exceptions import NotFound, ValidationError
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint, OrganizationPermission
from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers import serialize
from sentry.api.serializers.models.seer_night_shift_run import (  # noqa: F401 -- registers serializer
    SeerNightShiftRunSerializer,
)
from sentry.models.organization import Organization
from sentry.ratelimits.config import RateLimitConfig
from sentry.seer.models.night_shift import (
    SeerNightShiftRun,
    SeerNightShiftRunResult,
)
from sentry.seer.models.workflow import SeerWorkflowStrategy
from sentry.seer.monitor_cleanup import FEATURE, create_monitor_cleanup_run
from sentry.types.ratelimit import RateLimit, RateLimitCategory
from sentry.utils.numbers import validate_bigint

MANUAL_WORKFLOW_HANDLERS = {
    SeerWorkflowStrategy.DUPLICATE_MONITORS: create_monitor_cleanup_run,
}


class WorkflowRunCreateSerializer(serializers.Serializer):
    strategy = serializers.ChoiceField(choices=list(MANUAL_WORKFLOW_HANDLERS))


class WorkflowRunCreateResponse(TypedDict):
    runId: str
    url: str


class OrganizationSeerWorkflowsPermission(OrganizationPermission):
    scope_map = {
        "GET": ["org:read"],
        "POST": ["org:read"],
    }


@cell_silo_endpoint
class OrganizationSeerWorkflowsEndpoint(OrganizationEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
        "POST": ApiPublishStatus.PRIVATE,
    }
    owner = ApiOwner.ML_AI
    permission_classes = (OrganizationSeerWorkflowsPermission,)
    enforce_rate_limit = True
    rate_limits = RateLimitConfig(
        limit_overrides={
            "POST": {
                RateLimitCategory.USER: RateLimit(limit=1, window=60),
            },
        }
    )

    def get(self, request: Request, organization: Organization) -> Response:
        triage_enabled = features.has("organizations:seer-night-shift", organization)
        cleanup_enabled = features.has(FEATURE, organization, actor=request.user)
        if not triage_enabled and not cleanup_enabled:
            raise NotFound

        queryset = SeerNightShiftRun.objects.filter(organization_id=organization.id)
        if not cleanup_enabled:
            queryset = queryset.exclude(
                workflow_config__strategy=SeerWorkflowStrategy.DUPLICATE_MONITORS
            )
        if not triage_enabled:
            queryset = queryset.filter(
                workflow_config__strategy=SeerWorkflowStrategy.DUPLICATE_MONITORS
            )
        if cleanup_enabled:
            projects = self.get_projects(request, organization, include_all_accessible=True)
            inaccessible_results = (
                SeerNightShiftRunResult.objects.filter(
                    run__organization_id=organization.id,
                    kind=SeerWorkflowStrategy.DUPLICATE_MONITORS,
                )
                .exclude(extras__projectId__in=[str(p.id) for p in projects])
                .values("run_id")
            )
            queryset = queryset.exclude(id__in=inaccessible_results)
        if run_id := request.GET.get("runId"):
            if not run_id.isdecimal() or len(run_id) > 19 or not validate_bigint(int(run_id)):
                raise ValidationError({"runId": "Enter a valid run ID."})
            queryset = queryset.filter(id=run_id)

        return self.paginate(
            request=request,
            queryset=queryset,
            order_by="-date_added",
            on_results=lambda x: serialize(x, request.user),
            paginator_cls=OffsetPaginator,
        )

    @extend_schema(
        operation_id="Start a Seer workflow run",
        request=WorkflowRunCreateSerializer,
        responses={202: WorkflowRunCreateResponse},
    )
    def post(self, request: Request, organization: Organization) -> Response:
        serializer = WorkflowRunCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response({"detail": serializer.errors}, status=400)
        strategy = serializer.validated_data["strategy"]
        run = MANUAL_WORKFLOW_HANDLERS[strategy](request, organization)
        return Response(
            {
                "runId": str(run.id),
                "url": f"/organizations/{organization.slug}/issues/autofix/workflows/?runId={run.id}&expandLatest={strategy}",
            },
            status=202,
        )
