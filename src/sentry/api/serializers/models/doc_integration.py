from typing import Any, Mapping, MutableMapping

from sentry.api.serializers import Serializer, register
from sentry.models import DocIntegration
from sentry.models.user import User
from sentry.utils.json import JSONData


@register(DocIntegration)
class DocIntegrationSerializer(Serializer):
    def serialize(
        self,
        obj: DocIntegration,
        attrs: Mapping[str, Any],
        user: User,
        **kwargs: Any,
    ) -> MutableMapping[str, JSONData]:
        data = {
            "name": obj.name,
            "slug": obj.slug,
            "author": obj.author,
            "description": obj.description,
            "url": obj.url,
            "popularity": obj.popularity,
            "isDraft": obj.is_draft,
        }
        resources = obj.metadata.get("resources")
        if resources and len(resources):
            data["resourceLinks"] = resources
        return data
