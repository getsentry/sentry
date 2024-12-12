from django.conf import settings
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint
from sentry.auth.superuser import is_active_superuser
from sentry.models.project import Project
from sentry.tasks.embeddings_grouping.backfill_seer_grouping_records_for_project import (
    backfill_seer_grouping_records_for_project,
)


@region_silo_endpoint
class ProjectBackfillSimilarIssuesEmbeddingsRecords(ProjectEndpoint):
    owner = ApiOwner.ISSUES
    publish_status = {
        "POST": ApiPublishStatus.PRIVATE,
    }

    def post(self, request: Request, project: Project) -> Response:
        # needs to either be a superuser or be in single org mode
        if not (is_active_superuser(request) or settings.SENTRY_SINGLE_ORGANIZATION):
            return Response(status=404)

        # Define allowed keys
        allowed_keys = {
            "last_processed_id",
            "skip_project_ids",
            "only_delete",
            "enable_ingestion",
            "reprocess_backfilled_projects",
        }

        # Check for any disallowed keys
        disallowed_keys = set(request.data.keys()) - allowed_keys
        if disallowed_keys:
            return Response(
                data={"detail": f"Disallowed keys: {', '.join(disallowed_keys)}"},
                status=400,
            )

        last_processed_id = (
            int(request.data["last_processed_id"])
            if request.data.get("last_processed_id")
            else None
        )
        skip_project_ids = (
            request.data["skip_project_ids"] if request.data.get("skip_project_ids") else None
        )

        # These overwrite the defaults of backfill_seer_grouping_records_for_project
        only_delete = True if request.data.get("only_delete") else False
        enable_ingestion = True if request.data.get("enable_ingestion") else False
        # Notice that it reads as "reprocess" rather than "skip", thus, it's the opposite of what you'd expect
        skip_processed_projects = (
            False if request.data.get("reprocess_backfilled_projects") else True
        )

        if only_delete and enable_ingestion:
            return Response(
                data={"detail": "Cannot set both only_delete and enable_ingestion"},
                status=400,
            )

        backfill_seer_grouping_records_for_project.delay(
            current_project_id=project.id,
            last_processed_group_id_input=last_processed_id,
            only_delete=only_delete,
            enable_ingestion=enable_ingestion,
            skip_processed_projects=skip_processed_projects,
            skip_project_ids=skip_project_ids,
        )
        return Response(status=204)
