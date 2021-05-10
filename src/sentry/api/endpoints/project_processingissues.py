from rest_framework.response import Response

from sentry.api.bases.project import ProjectEndpoint
from sentry.api.helpers.processing_issues import get_processing_issues
from sentry.api.serializers import serialize
from sentry.models import ApiToken, ProcessingIssue
from sentry.reprocessing import trigger_reprocessing
from sentry.utils.http import absolute_uri
from sentry.web.helpers import render_to_response


class ProjectProcessingIssuesDiscardEndpoint(ProjectEndpoint):
    def delete(self, request, project):
        """
        This discards all open processing issues
        """
        ProcessingIssue.objects.discard_all_processing_issue(project=project)
        return Response(status=200)


class ProjectProcessingIssuesFixEndpoint(ProjectEndpoint):
    def get(self, request, project):
        token = None

        if request.user_from_signed_request and request.user.is_authenticated:
            tokens = [
                x
                for x in ApiToken.objects.filter(user=request.user).all()
                if "project:releases" in x.get_scopes()
            ]
            if not tokens:
                token = ApiToken.objects.create(
                    user=request.user,
                    scope_list=["project:releases"],
                    refresh_token=None,
                    expires_at=None,
                )
            else:
                token = tokens[0]

        resp = render_to_response(
            "sentry/reprocessing-script.sh",
            {
                "issues": [
                    {
                        "uuid": issue.data.get("image_uuid"),
                        "arch": issue.data.get("image_arch"),
                        "name": (issue.data.get("image_path") or "").split("/")[-1],
                    }
                    for issue in ProcessingIssue.objects.filter(project=project)
                ],
                "project": project,
                "token": token,
                "server_url": absolute_uri("/"),
            },
        )
        resp["Content-Type"] = "text/plain"
        return resp

    def permission_denied(self, request, message=None):
        resp = render_to_response("sentry/reprocessing-script.sh", {"token": None})
        resp["Content-Type"] = "text/plain"
        return resp


class ProjectProcessingIssuesEndpoint(ProjectEndpoint):
    def get(self, request, project):
        """
        List a project's processing issues.
        """
        data = get_processing_issues(
            request.user, [project], include_detailed_issues=request.GET.get("detailed") == "1"
        )[0]
        return Response(serialize(data, request.user))

    def delete(self, request, project):
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
