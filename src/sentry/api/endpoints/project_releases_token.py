from __future__ import absolute_import
from hashlib import sha256
import hmac
from uuid import uuid1
from rest_framework.response import Response

from django.core.urlresolvers import reverse
from sentry.utils.http import absolute_uri

from sentry.api.bases.project import ProjectEndpoint, StrictProjectPermission
from sentry.models import ProjectOption


def _get_webhook_url(project, plugin_id, token):

    return absolute_uri(
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
        msg=("{}-{}".format(plugin_id, project_id)).encode("utf-8"),
        digestmod=sha256,
    ).hexdigest()


class ProjectReleasesTokenEndpoint(ProjectEndpoint):
    permission_classes = (StrictProjectPermission,)

    def _regenerate_token(self, project):
        token = uuid1().hex
        ProjectOption.objects.set_value(project, "sentry:release-token", token)
        return token

    def get(self, request, project):
        token = ProjectOption.objects.get_value(project, "sentry:release-token")

        if token is None:
            token = self._regenerate_token(project)

        return Response({"token": token, "webhookUrl": _get_webhook_url(project, "builtin", token)})

    def post(self, request, project):
        token = self._regenerate_token(project)

        return Response({"token": token, "webhookUrl": _get_webhook_url(project, "builtin", token)})
