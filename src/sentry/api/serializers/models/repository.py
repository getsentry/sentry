from collections.abc import Mapping, Sequence
from datetime import datetime
from typing import Any, TypedDict

from sentry.api.serializers import Serializer, register
from sentry.models.repository import Repository
from sentry.models.repositorysettings import RepositorySettings


class RepositorySettingsSerializerResponse(TypedDict):
    enabledCodeReview: bool
    codeReviewTriggers: list[str]


class RepositorySerializerResponse(TypedDict, total=False):
    id: str
    name: str
    url: str | None
    provider: dict[str, str]
    status: str
    dateCreated: datetime
    integrationId: str | None
    externalSlug: str | None
    externalId: str | None
    settings: RepositorySettingsSerializerResponse | None


@register(RepositorySettings)
class RepositorySettingsSerializer(Serializer):
    def serialize(
        self, obj: RepositorySettings, attrs: Mapping[str, Any], user: Any, **kwargs: Any
    ) -> RepositorySettingsSerializerResponse:
        return {
            "enabledCodeReview": obj.enabled_code_review,
            "codeReviewTriggers": list(obj.code_review_triggers),
        }


@register(Repository)
class RepositorySerializer(Serializer):
    def __init__(self, expand: Sequence[str] | None = None) -> None:
        super().__init__()
        self.expand = expand or []

    def _expand(self, key: str) -> bool:
        return key in self.expand

    def get_attrs(
        self, item_list: Sequence[Repository], user: Any, **kwargs: Any
    ) -> dict[Repository, dict[str, Any]]:
        result: dict[Repository, dict[str, Any]] = {repo: {} for repo in item_list}

        if self._expand("settings"):
            repo_ids = [repo.id for repo in item_list]
            settings_by_repo = {
                setting.repository_id: setting
                for setting in RepositorySettings.objects.filter(repository_id__in=repo_ids)
            }
            for repo in item_list:
                result[repo]["settings"] = settings_by_repo.get(repo.id)

        return result

    def serialize(
        self, obj: Repository, attrs: Mapping[str, Any], user: Any, **kwargs: Any
    ) -> RepositorySerializerResponse:
        external_slug = None
        integration_id = None
        if obj.integration_id:
            integration_id = str(obj.integration_id)
        if obj.provider:
            repo_provider = obj.get_provider()
            provider = {"id": obj.provider, "name": repo_provider.name}
            external_slug = repo_provider.repository_external_slug(obj)
        else:
            provider = {"id": "unknown", "name": "Unknown Provider"}

        data: RepositorySerializerResponse = {
            "id": str(obj.id),
            "name": obj.config.get("pending_deletion_name", obj.name),
            "url": obj.url,
            "provider": provider,
            "status": obj.get_status_display(),
            "dateCreated": obj.date_added,
            "integrationId": integration_id,
            "externalSlug": external_slug,
            "externalId": obj.external_id,
        }

        if self._expand("settings"):
            settings = attrs.get("settings")
            if settings:
                data["settings"] = RepositorySettingsSerializer().serialize(settings, {}, user)
            else:
                data["settings"] = None

        return data
