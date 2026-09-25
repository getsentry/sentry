from collections.abc import Mapping, Sequence
from typing import Any, NotRequired, TypedDict

from django.db.models import prefetch_related_objects

from sentry.api.serializers import Serializer, register
from sentry.models.projectrepository import ProjectRepository


class ProjectRepositorySerializerResponse(TypedDict):
    id: str
    projectId: str
    repositoryId: str
    repoName: str
    source: str
    providerKey: str | None
    mappingCount: NotRequired[int]


@register(ProjectRepository)
class ProjectRepositorySerializer(Serializer[ProjectRepositorySerializerResponse]):
    def __init__(self, include_mapping_count: bool = False) -> None:
        super().__init__()
        self.include_mapping_count = include_mapping_count

    def get_attrs(
        self, item_list: Sequence[ProjectRepository], user: Any, **kwargs: Any
    ) -> dict[ProjectRepository, dict[str, Any]]:
        prefetch_related_objects(item_list, "repository")
        return {item: {} for item in item_list}

    def serialize(
        self,
        obj: ProjectRepository,
        attrs: Mapping[str, Any],
        user: Any,
        **kwargs: Any,
    ) -> ProjectRepositorySerializerResponse:
        repository = obj.repository
        provider = repository.provider
        provider_key = provider.removeprefix("integrations:") if provider else None

        result: ProjectRepositorySerializerResponse = {
            "id": str(obj.id),
            "projectId": str(obj.project_id),
            "repositoryId": str(repository.id),
            "repoName": repository.name,
            "source": obj.get_source_display(),
            "providerKey": provider_key,
        }

        if self.include_mapping_count:
            result["mappingCount"] = obj.mapping_count  # type: ignore[attr-defined]

        return result
