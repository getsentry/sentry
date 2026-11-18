from collections import defaultdict
from collections.abc import Mapping, Sequence
from datetime import datetime
from typing import Annotated, Any, TypedDict

from django.contrib.auth.models import AnonymousUser

from sentry.api.serializers import Serializer, register, serialize
from sentry.apidocs.descriptions import ApiDescription
from sentry.auth.access import Access
from sentry.integrations.models.data_forwarder import DataForwarder
from sentry.integrations.models.data_forwarder_project import DataForwarderProject
from sentry.users.models.user import User
from sentry.users.services.user import RpcUser


class ProjectResponse(TypedDict):
    id: Annotated[str, ApiDescription("ID of the project")]
    slug: Annotated[str, ApiDescription("Slug of the project")]
    platform: Annotated[str | None, ApiDescription("Platform of the project")]


class DataForwarderProjectResponse(TypedDict):
    id: Annotated[str, ApiDescription("ID of the project's data forwarding configuration")]
    isEnabled: Annotated[bool, ApiDescription("Whether data forwarding is on for the project")]
    dataForwarderId: Annotated[str, ApiDescription("ID of the data forwarder")]
    project: Annotated[ProjectResponse, ApiDescription("Project the configuration applies to")]
    # The overrides + effectiveConfig fields are omitted unless request has `org:write`, since the values are sensitive.
    overrides: Annotated[
        dict[str, str],
        ApiDescription(
            "Settings that override the forwarder's config for the project. Empty without project:write or org:write access"
        ),
    ]
    effectiveConfig: Annotated[
        dict[str, str],
        ApiDescription(
            "Forwarder config merged with the project's overrides. Empty without org:write access"
        ),
    ]
    dateAdded: Annotated[
        datetime, ApiDescription("When the project configuration was created (ISO 8601)")
    ]
    dateUpdated: Annotated[
        datetime, ApiDescription("When the project configuration was last updated (ISO 8601)")
    ]


class DataForwarderResponse(TypedDict):
    id: Annotated[str, ApiDescription("ID of the data forwarder")]
    organizationId: Annotated[str, ApiDescription("ID of the organization")]
    isEnabled: Annotated[bool, ApiDescription("Whether the data forwarder is on")]
    enrollNewProjects: Annotated[
        bool, ApiDescription("Whether new projects are enrolled in the forwarder automatically")
    ]
    enrolledProjects: Annotated[
        list[ProjectResponse], ApiDescription("Projects enrolled in the forwarder")
    ]
    provider: Annotated[
        str, ApiDescription("Service the data is forwarded to: segment, sqs or splunk")
    ]
    # The config is omitted unless request has `org:write`, since the values are sensitive.
    config: Annotated[
        dict[str, str] | None,
        ApiDescription("Provider settings of the forwarder. Null without org:write access"),
    ]
    projectConfigs: Annotated[
        list[DataForwarderProjectResponse], ApiDescription("Configuration of each enrolled project")
    ]
    dateAdded: Annotated[datetime, ApiDescription("When the data forwarder was created (ISO 8601)")]
    dateUpdated: Annotated[
        datetime, ApiDescription("When the data forwarder was last updated (ISO 8601)")
    ]


@register(DataForwarder)
class DataForwarderSerializer(Serializer[DataForwarderResponse]):
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
class DataForwarderProjectSerializer(Serializer[DataForwarderProjectResponse]):
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
