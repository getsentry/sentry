from __future__ import annotations

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
from sentry.seer.models.night_shift import SeerNightShiftRun, SeerNightShiftRunShard
from sentry.seer.models.workflow import SeerWorkflowStrategy
from sentry.seer.monitor_cleanup import FEATURE


class OrganizationSeerWorkflowsPermission(OrganizationPermission):
    scope_map = {
        "GET": ["org:read"],
    }


@cell_silo_endpoint
class OrganizationSeerWorkflowsEndpoint(OrganizationEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }
    owner = ApiOwner.ML_AI
    permission_classes = (OrganizationSeerWorkflowsPermission,)

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
            inaccessible_runs = (
                SeerNightShiftRunShard.objects.filter(
                    run__organization_id=organization.id,
                    run__workflow_config__strategy=SeerWorkflowStrategy.DUPLICATE_MONITORS,
                )
                .exclude(extras__project_id__in=[p.id for p in projects])
                .values("run_id")
            )
            queryset = queryset.exclude(id__in=inaccessible_runs)
        if run_id := request.GET.get("runId"):
            if not run_id.isdecimal() or len(run_id) > 19:
                raise ValidationError({"runId": "Enter a valid run ID."})
            queryset = queryset.filter(id=run_id)

        return self.paginate(
            request=request,
            queryset=queryset,
            order_by="-date_added",
            on_results=lambda x: serialize(x, request.user),
            paginator_cls=OffsetPaginator,
        )
