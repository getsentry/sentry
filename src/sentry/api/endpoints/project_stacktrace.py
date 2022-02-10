from django.conf import settings
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.bases.project import ProjectEndpoint
from sentry.http import safe_urlopen


class StacktraceEndpoint(ProjectEndpoint):
    def get(self, request: Request, project, transaction_id) -> Response:
        if not features.has("organizations:profiling", project.organization, actor=request.user):
            return Response(status=404)
        return safe_urlopen(
            settings.SENTRY_PROFILING_SERVICE_URL,
            method="GET",
            params={"project_id": project, "transaction_id": transaction_id},
        )
