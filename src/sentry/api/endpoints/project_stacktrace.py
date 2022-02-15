from django.conf import settings
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.bases.project import ProjectEndpoint
from sentry.http import safe_urlopen


class ProjectStacktraceEndpoint(ProjectEndpoint):
    def get(self, request: Request, project, transaction_id: str) -> Response:
        if not features.has("organizations:profiling", project.organization, actor=request.user):
            return Response(status=404)

        with self.handle_exception():
            response = safe_urlopen(
                f"{settings.SENTRY_PROFILING_SERVICE_URL}/projects/{project.id}/stacktraces/{transaction_id}",
                method="GET",
            )
            return Response(response.json(), status=response.status_code)
