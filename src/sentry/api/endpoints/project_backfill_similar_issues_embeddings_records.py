from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint
from sentry.auth.superuser import is_active_superuser
from sentry.tasks.backfill_seer_grouping_records import backfill_seer_grouping_records


@region_silo_endpoint
class ProjectBackfillSimilarIssuesEmbeddingsRecords(ProjectEndpoint):
    owner = ApiOwner.ISSUES
    publish_status = {
        "POST": ApiPublishStatus.PRIVATE,
    }

    def post(self, request: Request, project) -> Response:
        if not features.has(
            "projects:similarity-embeddings-grouping", project
        ) or not is_active_superuser(request):
            return Response(status=404)

        last_processed_id = None
        if request.data.get("last_processed_id"):
            last_processed_id = int(request.data["last_processed_id"])

        backfill_seer_grouping_records.delay(project.id, last_processed_id)
        return Response(status=204)
