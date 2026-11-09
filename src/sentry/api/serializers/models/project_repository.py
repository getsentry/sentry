from collections.abc import Mapping, Sequence
from typing import Annotated, NotRequired, TypedDict

from django.contrib.auth.models import AnonymousUser
from django.db.models import prefetch_related_objects

from sentry.api.serializers import Serializer, register
from sentry.apidocs.descriptions import ApiDescription
from sentry.models.projectrepository import ProjectRepository
from sentry.users.models.user import User
from sentry.users.services.user.model import RpcUser


class ProjectRepositorySerializerResponse(TypedDict):
    id: Annotated[str, ApiDescription("ID of the link between the project and the repository")]
    integrationId: Annotated[str | None, ApiDescription("ID of the repository's integration")]
    externalId: Annotated[str | None, ApiDescription("ID of the repository in the provider")]
    projectId: Annotated[str, ApiDescription("ID of the project")]
    repositoryId: Annotated[str, ApiDescription("ID of the repository")]
    repoName: Annotated[str, ApiDescription("Name of the repository")]
    source: Annotated[
        str,
        ApiDescription(
            "How the link was made: manual, scm_onboarding, auto_event, auto_name_match or seer_preference"
        ),
    ]
    providerKey: Annotated[
        str | None, ApiDescription("Key of the repository's provider, such as github")
    ]
    mappingCount: NotRequired[
        Annotated[
            int, ApiDescription("Number of code mappings between the project and the repository")
        ]
    ]


@register(ProjectRepository)
class ProjectRepositorySerializer(Serializer[ProjectRepositorySerializerResponse]):
    def __init__(self, include_mapping_count: bool = False) -> None:
        super().__init__()
        self.include_mapping_count = include_mapping_count

    def get_attrs(
        self,
        item_list: Sequence[ProjectRepository],
        user: User | RpcUser | AnonymousUser,
        **kwargs: object,
    ) -> dict[ProjectRepository, dict[str, object]]:
        prefetch_related_objects(item_list, "repository")
        return {item: {} for item in item_list}

    def serialize(
        self,
        obj: ProjectRepository,
        attrs: Mapping[str, object],
        user: User | RpcUser | AnonymousUser,
        **kwargs: object,
    ) -> ProjectRepositorySerializerResponse:
        repository = obj.repository
        provider = repository.provider
        provider_key = provider.removeprefix("integrations:") if provider else None

        result: ProjectRepositorySerializerResponse = {
            "id": str(obj.id),
            "integrationId": (
                str(repository.integration_id) if repository.integration_id is not None else None
            ),
            "externalId": repository.external_id,
            "projectId": str(obj.project_id),
            "repositoryId": str(repository.id),
            "repoName": repository.name,
            "source": obj.get_source_display(),
            "providerKey": provider_key,
        }

        if self.include_mapping_count:
            result["mappingCount"] = obj.mapping_count  # type: ignore[attr-defined]

        return result
