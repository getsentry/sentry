from __future__ import annotations

from rest_framework.exceptions import NotFound
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint, ProjectEventPermission
from sentry.models.project import Project
from sentry.tasks.seer.night_shift.cron import run_night_shift_for_project


@cell_silo_endpoint
class ProjectSeerNightShiftEndpoint(ProjectEndpoint):
    publish_status = {
        "POST": ApiPublishStatus.PRIVATE,
    }
    owner = ApiOwner.ML_AI
    permission_classes = (ProjectEventPermission,)

    def post(self, request: Request, project: Project) -> Response:
        if not features.has("organizations:seer-night-shift", project.organization):
            raise NotFound

        dry_run = bool(request.data.get("dryRun", False))

        run_night_shift_for_project.apply_async(
            args=[project.id],
            kwargs={"dry_run": dry_run},
        )
        return Response(status=202)
