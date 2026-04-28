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
from sentry.tasks.seer.night_shift.cron import run_nightshift_for_projects
from sentry.tasks.seer.night_shift.tweaks import get_night_shift_tweaks

logger = logging.getLogger("sentry.seer.endpoints.project_seer_night_shift")


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
        tweaks = get_night_shift_tweaks(project)

        logger.info(
            "night_shift.manual_trigger.dispatched",
            extra={
                "project_id": project.id,
                "project_slug": project.slug,
                "organization_id": project.organization_id,
                "dry_run": dry_run,
                "max_candidates": tweaks.max_candidates,
                "intelligence_level": tweaks.intelligence_level,
                "reasoning_effort": tweaks.reasoning_effort,
                "extra_triage_instructions": tweaks.extra_triage_instructions,
            },
        )

        agent_run_id = run_nightshift_for_projects(
            project_ids=[project.id],
            dry_run=dry_run,
            max_candidates=tweaks.max_candidates,
            intelligence_level=tweaks.intelligence_level,
            reasoning_effort=tweaks.reasoning_effort,
            extra_triage_instructions=tweaks.extra_triage_instructions,
        )
        return Response({"agent_run_id": agent_run_id}, status=200)
