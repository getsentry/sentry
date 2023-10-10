from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint

__all__ = ["PluginProjectEndpoint", "PluginGroupEndpoint"]

from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.bases.group import GroupEndpoint
from sentry.api.bases.project import ProjectEndpoint
from sentry.models.groupmeta import GroupMeta


class PluginProjectEndpoint(ProjectEndpoint):
    plugin = None
    view = None

    def _handle(self, request: Request, project, *args, **kwargs):
        if self.view is None:
            return Response(status=405)
        return self.view(request, project, *args, **kwargs)

    def get(self, request: Request, project, *args, **kwargs) -> Response:
        return self._handle(request, project, *args, **kwargs)

    def post(self, request: Request, project, *args, **kwargs) -> Response:
        return self._handle(request, project, *args, **kwargs)

    def respond(self, *args, **kwargs):
        return Response(*args, **kwargs)


from rest_framework.request import Request
from rest_framework.response import Response


@region_silo_endpoint
class PluginGroupEndpoint(GroupEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.UNKNOWN,
        "POST": ApiPublishStatus.UNKNOWN,
    }
    plugin = None
    view = None

    def _handle(self, request: Request, group, *args, **kwargs):
        if self.view is None:
            return Response(status=405)

        GroupMeta.objects.populate_cache([group])

        return self.view(request, group, *args, **kwargs)

    def get(self, request: Request, group, *args, **kwargs) -> Response:
        return self._handle(request, group, *args, **kwargs)

    def post(self, request: Request, group, *args, **kwargs) -> Response:
        return self._handle(request, group, *args, **kwargs)

    def respond(self, *args, **kwargs):
        return Response(*args, **kwargs)
