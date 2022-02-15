from typing import Any, List, Mapping

from sentry.api.serializers import Serializer, register, serialize
from sentry.models import DocIntegration, DocIntegrationAvatar, IntegrationFeature
from sentry.models.integrations.integration_feature import IntegrationTypes
from sentry.models.user import User
from sentry.utils.compat import map
from sentry.utils.json import JSONData


@register(DocIntegration)
class DocIntegrationSerializer(Serializer):
    def get_attrs(self, item_list: List[DocIntegration], user: User, **kwargs: Any):
        # Get associated IntegrationFeatures
        doc_feature_attrs = IntegrationFeature.objects.get_by_targets_as_dict(
            targets=item_list, target_type=IntegrationTypes.DOC_INTEGRATION
        )

        # Get associated DocIntegrationAvatar
        avatars = DocIntegrationAvatar.objects.filter(doc_integration__in=item_list)
        doc_avatar_attrs = {avatar.doc_integration_id: avatar for avatar in avatars}

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
