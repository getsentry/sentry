from django.conf import settings
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint
from sentry.auth.superuser import is_active_superuser
from sentry.tasks.embeddings_grouping.backfill_seer_grouping_records_for_project import (
    backfill_seer_grouping_records_for_project,
)


@region_silo_endpoint
class ProjectBackfillSimilarIssuesEmbeddingsRecords(ProjectEndpoint):
    owner = ApiOwner.ISSUES
    publish_status = {
        "POST": ApiPublishStatus.PRIVATE,
    }

    def post(self, request: Request, project) -> Response:
        if not features.has("projects:similarity-embeddings-backfill", project):
            return Response(status=404)

        # needs to have the flag to run

        if not (is_active_superuser(request) or settings.SENTRY_SINGLE_ORGANIZATION):
            return Response(status=404)

        # needs to either be a superuser or be in single org mode

        last_processed_id = None
        only_delete = False
        if request.data.get("last_processed_id"):
            last_processed_id = int(request.data["last_processed_id"])

        if request.data.get("only_delete"):
            only_delete = True

        backfill_seer_grouping_records_for_project.delay(
            current_project_id=project.id,
            last_processed_group_id_input=last_processed_id,
            only_delete=only_delete,
        )
        return Response(status=204)
