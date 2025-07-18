import hmac
from hashlib import sha256
from uuid import uuid1

from django.urls import reverse
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint, StrictProjectPermission
from sentry.models.options.project_option import ProjectOption
from sentry.types.region import get_local_region


def _get_webhook_url(project, plugin_id, token):
    region = get_local_region()
    return region.to_url(
        reverse(
            "sentry-release-hook",
            kwargs={
                "plugin_id": plugin_id,
                "project_id": project.id,
                "signature": _get_signature(project.id, plugin_id, token),
            },
        )
    )


def _get_signature(project_id, plugin_id, token):
    return hmac.new(
        key=token.encode("utf-8"),
        msg=(f"{plugin_id}-{project_id}").encode(),
        digestmod=sha256,
    ).hexdigest()


@region_silo_endpoint
class ProjectReleasesTokenEndpoint(ProjectEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.UNKNOWN,
        "POST": ApiPublishStatus.UNKNOWN,
    }
    permission_classes = (StrictProjectPermission,)

    def _regenerate_token(self, project):
        token = uuid1().hex
        ProjectOption.objects.set_value(project, "sentry:release-token", token)
        return token

    def get(self, request: Request, project) -> Response:
        token = ProjectOption.objects.get_value(project, "sentry:release-token")

        if token is None:
            token = self._regenerate_token(project)

        return Response({"token": token, "webhookUrl": _get_webhook_url(project, "builtin", token)})

    def post(self, request: Request, project) -> Response:
        token = self._regenerate_token(project)

        return Response({"token": token, "webhookUrl": _get_webhook_url(project, "builtin", token)})
