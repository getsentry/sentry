from django.conf import settings
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.bases.project import ProjectEndpoint
from sentry.http import safe_urlopen
from sentry.utils.cloudrun import fetch_id_token_for_service


class ProjectProfilingProfileEndpoint(ProjectEndpoint):
    def get(self, request: Request, project, transaction_id: str) -> Response:
        if not features.has("organizations:profiling", project.organization, actor=request.user):
            return Response(status=404)

        id_token = fetch_id_token_for_service(settings.SENTRY_PROFILING_SERVICE_URL)
        response = safe_urlopen(
            f"{settings.SENTRY_PROFILING_SERVICE_URL}/projects/{project.id}/profiles/{transaction_id}",
            method="GET",
            headers={"Authorization": f"Bearer {id_token}"},
        )

        return Response(response.json(), status=response.status_code)
