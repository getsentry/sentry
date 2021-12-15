from collections import defaultdict
from typing import Any, List, Mapping

from sentry.api.serializers import Serializer, register, serialize
from sentry.models.integration import DocIntegration
from sentry.models.integrationfeature import IntegrationFeature, IntegrationTypes
from sentry.models.user import User
from sentry.utils.compat import map
from sentry.utils.json import JSONData


@register(DocIntegration)
class DocIntegrationSerializer(Serializer):
    def get_attrs(self, item_list: List[DocIntegration], user: User, **kwargs: Any):
        target_ids = {item.id for item in item_list}
        features = IntegrationFeature.objects.filter(
            target_type=IntegrationTypes.DOC_INTEGRATION.value, target_id__in=target_ids
        )
        features_by_target = defaultdict(set)
        for feature in features:
            features_by_target[feature.target_id].add(feature)
        return {item: {"features": features_by_target.get(item.id, set())} for item in item_list}

    def serialize(
        self,
        obj: DocIntegration,
        attrs: Mapping[str, Any],
        user: User,
        **kwargs: Any,
    ) -> JSONData:
        data = {
            "name": obj.name,
            "slug": obj.slug,
            "author": obj.author,
            "description": obj.description,
            "url": obj.url,
            "popularity": obj.popularity,
            "isDraft": obj.is_draft,
            "features": map(lambda x: serialize(x, user), attrs.get("features")),
        }

        if obj.metadata:
            data.update({k: v for k, v in obj.metadata.items()})

        return data
