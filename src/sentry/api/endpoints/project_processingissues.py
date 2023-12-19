from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint
from sentry.api.helpers.processing_issues import get_processing_issues
from sentry.api.serializers import serialize
from sentry.models.processingissue import ProcessingIssue
from sentry.reprocessing import trigger_reprocessing


@region_silo_endpoint
class ProjectProcessingIssuesDiscardEndpoint(ProjectEndpoint):
    owner = ApiOwner.ISSUES
    publish_status = {
        "DELETE": ApiPublishStatus.UNKNOWN,
    }

    def delete(self, request: Request, project) -> Response:
        """
        This discards all open processing issues
        """
        ProcessingIssue.objects.discard_all_processing_issue(project=project)
        return Response(status=200)


@region_silo_endpoint
class ProjectProcessingIssuesEndpoint(ProjectEndpoint):
    owner = ApiOwner.ISSUES
    publish_status = {
        "DELETE": ApiPublishStatus.UNKNOWN,
        "GET": ApiPublishStatus.UNKNOWN,
    }

    def get(self, request: Request, project) -> Response:
        """
        List a project's processing issues.
        """
        data = get_processing_issues(
            request.user, [project], include_detailed_issues=request.GET.get("detailed") == "1"
        )[0]
        return Response(serialize(data, request.user))

    def delete(self, request: Request, project) -> Response:
        """
        This deletes all open processing issues and triggers reprocessing if
        the user disabled the checkbox
        """
        reprocessing_active = bool(project.get_option("sentry:reprocessing_active", True))
        if not reprocessing_active:
            ProcessingIssue.objects.resolve_all_processing_issue(project=project)
            trigger_reprocessing(project)
            return Response(status=200)
        return Response(status=304)
