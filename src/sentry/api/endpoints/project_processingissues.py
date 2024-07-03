from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint
from sentry.api.serializers import serialize


@region_silo_endpoint
class ProjectProcessingIssuesDiscardEndpoint(ProjectEndpoint):
    owner = ApiOwner.ISSUES
    publish_status = {
        "DELETE": ApiPublishStatus.PRIVATE,
    }

    def delete(self, request: Request, project) -> Response:
        """
        This discards all open processing issues
        """
        return Response(status=200)


@region_silo_endpoint
class ProjectProcessingIssuesEndpoint(ProjectEndpoint):
    owner = ApiOwner.ISSUES
    publish_status = {
        "DELETE": ApiPublishStatus.PRIVATE,
        "GET": ApiPublishStatus.PRIVATE,
    }

    def get(self, request: Request, project) -> Response:
        """
        List a project's processing issues.
        """
        data = {
            "hasIssues": False,
            "numIssues": 0,
            "lastSeen": None,
            "resolveableIssues": 0,
            "hasMoreResolveableIssues": False,
            "issuesProcessing": 0,
            "project": project.slug,
            "issues": [],
        }
        return Response(serialize(data, request.user))

    def delete(self, request: Request, project) -> Response:
        """
        This deletes all open processing issues and triggers reprocessing if
        the user disabled the checkbox
        """
        return Response(status=304)
