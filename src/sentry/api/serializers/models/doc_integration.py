from collections import defaultdict
from typing import Any, List, Mapping

from sentry.api.serializers import Serializer, register, serialize
from sentry.models import DocIntegrationAvatar
from sentry.models.integration import DocIntegration
from sentry.models.integrationfeature import IntegrationFeature, IntegrationTypes
from sentry.models.user import User
from sentry.utils.compat import map
from sentry.utils.json import JSONData


@register(DocIntegration)
class DocIntegrationSerializer(Serializer):
    def get_attrs(self, item_list: List[DocIntegration], user: User, **kwargs: Any):
        # Get associated IntegrationFeatures
        doc_ids = {item.id for item in item_list}
        features = IntegrationFeature.objects.filter(
            target_type=IntegrationTypes.DOC_INTEGRATION.value, target_id__in=doc_ids
        )
        doc_feature_attrs = defaultdict(set)
        for feature in features:
            doc_feature_attrs[feature.target_id].add(feature)

        # Get associated DocIntegrationAvatar
        avatars = DocIntegrationAvatar.objects.filter(doc_integration__in=item_list)
        doc_avatar_attrs = defaultdict(DocIntegrationAvatar)
        for avatar in avatars:
            doc_avatar_attrs[avatar.doc_integration_id] = avatar

        # Attach both as attrs
        return {
            item: {
                "features": doc_feature_attrs.get(item.id, set()),
                "avatar": doc_avatar_attrs.get(item.id),
            }
            for item in item_list
        }

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
            "avatar": serialize(attrs.get("avatar"), user),
        }

        if obj.metadata:
            data.update(obj.metadata)

        return data
