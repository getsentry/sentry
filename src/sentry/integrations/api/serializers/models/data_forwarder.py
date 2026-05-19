from collections import defaultdict
from collections.abc import Mapping, Sequence
from datetime import datetime
from typing import Any, TypedDict

from django.contrib.auth.models import AnonymousUser

from sentry.api.serializers import Serializer, register, serialize
from sentry.auth.access import Access
from sentry.integrations.models.data_forwarder import DataForwarder
from sentry.integrations.models.data_forwarder_project import DataForwarderProject
from sentry.users.models.user import User
from sentry.users.services.user import RpcUser


class ProjectResponse(TypedDict):
    id: str
    slug: str
    platform: str | None


class DataForwarderProjectResponse(TypedDict):
    id: str
    isEnabled: bool
    dataForwarderId: str
    project: ProjectResponse
    # The overrides + effectiveConfig fields are omitted unless request has `org:write`, since the values are sensitive.
    overrides: dict[str, str]
    effectiveConfig: dict[str, str]
    dateAdded: datetime
    dateUpdated: datetime


class DataForwarderResponse(TypedDict):
    id: str
    organizationId: str
    isEnabled: bool
    enrollNewProjects: bool
    enrolledProjects: list[ProjectResponse]
    provider: str
    # The config is omitted unless request has `org:write`, since the values are sensitive.
    config: dict[str, str] | None
    projectConfigs: list[DataForwarderProjectResponse]
    dateAdded: datetime
    dateUpdated: datetime


@register(DataForwarder)
class DataForwarderSerializer(Serializer):
    def get_attrs(
        self,
        item_list: Sequence[DataForwarder],
        user: User | RpcUser | AnonymousUser,
        **kwargs: Any,
    ) -> dict[DataForwarder, dict[str, Any]]:
        project_configs = DataForwarderProject.objects.filter(
            data_forwarder__in=item_list
        ).select_related("project", "data_forwarder")
        project_config_attrs = defaultdict(set)
        for project_config in project_configs:
            project_config_attrs[project_config.data_forwarder].add(project_config)

        return {
            data_forwarder: {"project_configs": project_config_attrs.get(data_forwarder, set())}
            for data_forwarder in item_list
        }

    def serialize(
        self,
        obj: DataForwarder,
        attrs: Mapping[str, Any],
        user: User | RpcUser | AnonymousUser,
        **kwargs: Any,
    ) -> DataForwarderResponse:
        access: Access | None = kwargs.get("access")
        has_config_access = access.has_scope("org:write") if access else False
        project_configs = attrs.get("project_configs", set())

        return {
            "id": str(obj.id),
            "organizationId": str(obj.organization_id),
            "isEnabled": obj.is_enabled,
            "enrollNewProjects": obj.enroll_new_projects,
            "enrolledProjects": [
                {
                    "id": str(project_config.project_id),
                    "slug": project_config.project.slug,
                    "platform": project_config.project.platform,
                }
                for project_config in project_configs
            ],
            "provider": obj.provider,
            "config": obj.config if has_config_access else None,
            "projectConfigs": [
                serialize(project_config, user=user, access=access)
                for project_config in project_configs
            ],
            "dateAdded": obj.date_added,
            "dateUpdated": obj.date_updated,
        }


@register(DataForwarderProject)
class DataForwarderProjectSerializer(Serializer):
    def serialize(
        self,
        obj: DataForwarderProject,
        attrs: Mapping[str, Any],
        user: User | RpcUser | AnonymousUser,
        **kwargs: Any,
    ) -> DataForwarderProjectResponse:
        access: Access | None = kwargs.get("access")
        has_config_access = False
        has_override_access = False
        if access:
            has_config_access = access.has_scope("org:write")
            has_override_access = has_config_access or access.has_project_scope(
                obj.project, "project:write"
            )
        return {
            "id": str(obj.id),
            "isEnabled": obj.is_enabled,
            "dataForwarderId": str(obj.data_forwarder_id),
            "project": {
                "id": str(obj.project_id),
                "slug": obj.project.slug,
                "platform": obj.project.platform,
            },
            "overrides": obj.overrides if has_override_access else {},
            "effectiveConfig": obj.get_config() if has_config_access else {},
            "dateAdded": obj.date_added,
            "dateUpdated": obj.date_updated,
        }
