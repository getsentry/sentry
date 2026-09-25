from __future__ import annotations

import logging

from rest_framework.exceptions import NotFound
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint, ProjectEventPermission
from sentry.models.project import Project
from sentry.tasks.seer.agentic_triage.cron import (
    SeerAgenticTriageRunOptionsPartial,
    run_agentic_triage_for_org,
)

logger = logging.getLogger("sentry.seer.endpoints.project_seer_agentic_triage")


@cell_silo_endpoint
class ProjectSeerAgenticTriageEndpoint(ProjectEndpoint):
    publish_status = {
        "POST": ApiPublishStatus.PRIVATE,
    }
    owner = ApiOwner.ML_AI
    permission_classes = (ProjectEventPermission,)

    def post(self, request: Request, project: Project) -> Response:
        if not features.has("organizations:seer-night-shift", project.organization):
            raise NotFound

        dry_run = bool(request.data.get("dryRun", False))
        triggering_user_id = request.user.id if request.user.is_authenticated else None

        logger.info(
            "agentic_triage.manual_trigger.dispatched",
            extra={
                "project_id": project.id,
                "project_slug": project.slug,
                "organization_id": project.organization_id,
                "triggering_user_id": triggering_user_id,
                "dry_run": dry_run,
            },
        )

        # The project's tweaks (and any per-org overrides) are resolved by
        # build_run_options inside run_agentic_triage_for_org, which scopes them to
        # the single project_id below.
        options: SeerAgenticTriageRunOptionsPartial = {
            "source": "manual",
            "dry_run": dry_run,
        }
        run_id = run_agentic_triage_for_org(
            project.organization_id,
            options=options,
            project_ids=[project.id],
            triggering_user_id=triggering_user_id,
            execute_in_task=True,
        )
        return Response({"run_id": run_id}, status=200)
