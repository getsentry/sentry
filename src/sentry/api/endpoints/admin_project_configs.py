from collections.abc import MutableMapping
from typing import Any

from django.http import Http404
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import Endpoint, region_silo_endpoint
from sentry.api.permissions import SuperuserOrStaffFeatureFlaggedPermission
from sentry.models.project import Project
from sentry.models.projectkey import ProjectKey
from sentry.relay import projectconfig_cache
from sentry.relay.config import ProjectConfig, get_project_config
from sentry.tasks.relay import schedule_invalidate_project_config


@region_silo_endpoint
class AdminRelayProjectConfigsEndpoint(Endpoint):
    owner = ApiOwner.OWNERS_INGEST
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
        "POST": ApiPublishStatus.PRIVATE,
    }
    permission_classes = (SuperuserOrStaffFeatureFlaggedPermission,)

    def get(self, request: Request) -> Response:
        """The GET endpoint retrieves the project configs for a specific project_id
        or a set of project keys.
        If a projectId is provided, the configs for all project keys are returned.
        If a projectKey is provided, the config for that specific project key is returned.
        Both a projectId and a projectKey may be provided in the same request.

        If the project config is currently in cache, will return the cache entry.
        If the project config is not in cache, the project config for that key will be null.
        """
        project_id = request.GET.get("projectId")
        project_key_param = request.GET.get("projectKey")

        if not project_id and not project_key_param:
            return Response(
                {"error": "Please supply either the projectId or projectKey parameter."}, status=400
            )

        try:
            if project_id:
                project = Project.objects.get_from_cache(id=project_id)
            else:
                project = None
            if project_key_param:
                supplied_project_key = ProjectKey.objects.get(public_key=project_key_param)
            else:
                supplied_project_key = None
        except Exception:
            raise Http404

        project_keys = self._get_project_keys(project, supplied_project_key)

        configs: MutableMapping[str, MutableMapping[str, Any] | ProjectConfig | None] = {}
        uncached_keys = []
        for project_key in project_keys:
            if isinstance(project_key, ProjectKey) and project_key.public_key is not None:
                cached_config = projectconfig_cache.backend.get(project_key.public_key)
                if cached_config is not None:
                    configs[project_key.public_key] = cached_config
                else:
                    configs[project_key.public_key] = None
                    uncached_keys.append(project_key)

        if uncached_keys:
            if supplied_project_key is not None:
                generated_configs = self._get_project_config_sync(
                    supplied_project_key.project, uncached_keys
                )
            elif project is not None:
                generated_configs = self._get_project_config_sync(project, uncached_keys)
            else:
                generated_configs = {}

            for key, config in generated_configs.items():
                configs[key] = config

        return Response({"configs": configs}, status=200)

    def post(self, request: Request) -> Response:
        """The POST endpoint recalculates the project configs for a specific projectId.
        The project config for all projectKeys of the provided projectId is recalculated
        in a sync manner and stored in the cache subsequently.
        """
        project_id = request.data.get("projectId")

        if not project_id:
            return Response({"error": "Missing projectId parameter"}, status=400)

        try:
            project = Project.objects.get_from_cache(id=project_id)
            project_keys = self._get_project_keys(project)
            schedule_invalidate_project_config(
                project_id=project_id, trigger="_admin_trigger_invalidate_project_config"
            )
        except Exception:
            raise Http404

        configs = self._get_project_config_sync(project, project_keys)
        projectconfig_cache.backend.set_many(configs)
        return Response(status=201)

    def _get_project_keys(
        self, project: Project | None = None, project_key: ProjectKey | None = None
    ) -> list[ProjectKey]:
        project_keys = []

        if project_key is not None:
            project_keys.append(project_key)

        if project is not None:
            for project_key2 in project.key_set.all():
                project_keys.append(project_key2)

        return project_keys

    def _get_project_config_sync(
        self, project: Project, project_keys: list[ProjectKey]
    ) -> MutableMapping[str, MutableMapping[str, Any]]:
        configs: MutableMapping[str, MutableMapping[str, Any]] = {}

        for project_key in project_keys:
            if project_key.public_key is not None:
                configs[project_key.public_key] = get_project_config(
                    project, project_keys=[project_key]
                ).to_dict()

        return configs
