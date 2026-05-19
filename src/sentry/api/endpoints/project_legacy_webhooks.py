from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint
from sentry.models.options.project_option import ProjectOption
from sentry.models.project import Project
from sentry.net.socket import is_valid_url
from sentry.sentry_apps.services.legacy_webhook.service import split_urls


@cell_silo_endpoint
class ProjectLegacyWebhooksEndpoint(ProjectEndpoint):
    owner = ApiOwner.INTEGRATION_PLATFORM
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
        "POST": ApiPublishStatus.PRIVATE,
        "DELETE": ApiPublishStatus.PRIVATE,
    }

    def get(self, request: Request, project: Project) -> Response:
        urls_raw = ProjectOption.objects.get_value(project, "webhooks:urls", default="")
        urls = split_urls(urls_raw)
        return Response({"urls": urls})

    def post(self, request: Request, project: Project) -> Response:
        urls = request.data.get("urls", [])
        if not isinstance(urls, list):
            return Response({"detail": "urls must be a list"}, status=400)

        for url in urls:
            if not isinstance(url, str):
                return Response({"detail": "Each URL must be a string"}, status=400)
            if not url.startswith(("http://", "https://")) or not is_valid_url(url):
                return Response({"detail": f"Invalid URL: {url}"}, status=400)

        ProjectOption.objects.set_value(project, "webhooks:urls", "\n".join(urls))
        return Response({"urls": urls}, status=200)

    def delete(self, request: Request, project: Project) -> Response:
        ProjectOption.objects.unset_value(project, "webhooks:urls")
        return Response(status=204)
