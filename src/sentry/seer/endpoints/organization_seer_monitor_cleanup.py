from typing import TypedDict

from django.db import router, transaction
from drf_spectacular.utils import extend_schema
from rest_framework.exceptions import NotFound, PermissionDenied
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint, OrganizationPermission
from sentry.incidents.grouptype import MetricIssue
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.seer.models.night_shift import SeerNightShiftRun, SeerNightShiftRunShard
from sentry.seer.models.workflow import SeerWorkflowConfig, SeerWorkflowStrategy
from sentry.seer.monitor_cleanup import FEATURE
from sentry.tasks.seer.monitor_cleanup import dispatch_run


class MonitorCleanupTriggerPermission(OrganizationPermission):
    scope_map = {"POST": ["org:read"]}


class MonitorCleanupTriggerResponse(TypedDict):
    runId: str
    url: str


@cell_silo_endpoint
class OrganizationSeerMonitorCleanupEndpoint(OrganizationEndpoint):
    owner = ApiOwner.ML_AI
    permission_classes = (MonitorCleanupTriggerPermission,)
    publish_status = {"POST": ApiPublishStatus.PRIVATE}

    @extend_schema(
        operation_id="Trigger a duplicate monitor scan",
        request=None,
        responses={202: MonitorCleanupTriggerResponse},
    )
    def post(self, request: Request, organization: Organization) -> Response:
        if not features.has(FEATURE, organization, actor=request.user):
            raise NotFound
        if not request.user.is_authenticated:
            raise PermissionDenied("Sign in to run a monitor scan.")
        accessible_projects = self.get_projects(request, organization, include_all_accessible=True)
        projects = list(
            Project.objects.filter(
                organization=organization,
                id__in=[project.id for project in accessible_projects],
                detector__type=MetricIssue.slug,
            )
            .distinct()
            .order_by("id")
        )
        if not projects:
            return Response({"detail": "No accessible projects have metric monitors."}, status=400)
        if len(projects) > 20:
            return Response(
                {"detail": "This demo supports up to 20 projects with metric monitors."}, status=400
            )
        config = SeerWorkflowConfig.get_or_create_for_strategy(
            organization.id, SeerWorkflowStrategy.DUPLICATE_MONITORS
        )
        with transaction.atomic(router.db_for_write(SeerNightShiftRun)):
            run = SeerNightShiftRun.objects.create(
                organization=organization,
                workflow_config=config,
                extras={
                    "options": {"source": "manual"},
                    "triggering_user_id": request.user.id,
                    "target_project_ids": [p.id for p in projects],
                    "status": "running",
                },
            )
            SeerNightShiftRunShard.objects.bulk_create(
                [
                    SeerNightShiftRunShard(
                        run=run,
                        extras={"project_id": p.id, "project_slug": p.slug, "status": "queued"},
                    )
                    for p in projects
                ]
            )
            transaction.on_commit(
                lambda: dispatch_run(run.id), using=router.db_for_write(SeerNightShiftRun)
            )
        return Response(
            {
                "runId": str(run.id),
                "url": f"/organizations/{organization.slug}/issues/autofix/workflows/?runId={run.id}&expandLatest=duplicate_monitors",
            },
            status=202,
        )
