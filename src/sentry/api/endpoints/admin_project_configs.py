from django.http import Http404
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.base import Endpoint, region_silo_endpoint
from sentry.api.permissions import SuperuserPermission
from sentry.models import Project
from sentry.relay import projectconfig_cache


@region_silo_endpoint
class AdminRelayProjectConfigsEndpoint(Endpoint):
    permission_classes = (SuperuserPermission,)

    def get(self, request: Request) -> Response:
        project_id = request.GET.get("projectId")

        project_keys = []
        if project_id is not None:
            try:
                project = Project.objects.get_from_cache(id=project_id)
                for project_key in project.key_set.all():
                    project_keys.append(project_key.public_key)

            except Exception:
                raise Http404

        project_key = request.GET.get("projectKey")
        if project_key is not None:
            project_keys.append(project_key)

        configs = {}
        for key in project_keys:
            cached_config = projectconfig_cache.get(key)
            if cached_config is not None:
                configs[key] = cached_config
            else:
                configs[key] = None

        # TODO if we don't think we'll add anything to the endpoint
        # we may as well return just the configs
        return Response({"configs": configs}, status=200)
