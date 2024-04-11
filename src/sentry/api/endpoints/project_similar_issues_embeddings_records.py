from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint
from sentry.tasks.backfill_seer_grouping_records import backfill_seer_grouping_records


@region_silo_endpoint
class ProjectSimilarIssuesEmbeddingsRecords(ProjectEndpoint):
    owner = ApiOwner.ISSUES
    publish_status = {
        "POST": ApiPublishStatus.PRIVATE,
    }

    def post(self, request: Request, project) -> Response:
        if not features.has("projects:similarity-embeddings-grouping", project):
            return Response(status=404)
        backfill_seer_grouping_records.delay(project)
        return Response(status=204)
