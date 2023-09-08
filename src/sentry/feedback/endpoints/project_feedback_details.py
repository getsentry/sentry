from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint
from sentry.models.project import Project


@region_silo_endpoint
class ProjectFeedbackDetailsEndpoint(ProjectEndpoint):
    publish_status = {
        "DELETE": ApiPublishStatus.EXPERIMENTAL,
        "GET": ApiPublishStatus.EXPERIMENTAL,
        "PATCH": ApiPublishStatus.EXPERIMENTAL,
    }
    owner = ApiOwner.FEEDBACK

    def get(self, request: Request, project: Project, feedback_id: str) -> Response:
        raise NotImplementedError()

    def delete(self, request: Request, project: Project, feedback_id: str) -> Response:
        raise NotImplementedError()

    def patch(self, request: Request, project: Project, feedback_id: str) -> Response:
        raise NotImplementedError()
