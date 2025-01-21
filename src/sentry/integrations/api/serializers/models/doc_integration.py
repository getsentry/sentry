from collections.abc import Mapping, Sequence
from typing import Any

from django.contrib.auth.models import AnonymousUser

from sentry.api.serializers import Serializer, register, serialize
from sentry.integrations.models.doc_integration import DocIntegration
from sentry.integrations.models.doc_integration_avatar import DocIntegrationAvatar
from sentry.integrations.models.integration_feature import IntegrationFeature, IntegrationTypes
from sentry.users.models.user import User
from sentry.users.services.user import RpcUser


@register(DocIntegration)
class DocIntegrationSerializer(Serializer):
    def get_attrs(
        self,
        item_list: Sequence[DocIntegration],
        user: User | RpcUser | AnonymousUser,
        **kwargs: Any,
    ):
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
        user: User | RpcUser | AnonymousUser,
        **kwargs: Any,
    ) -> Any:
        features = attrs.get("features")
        data = {
            "name": obj.name,
            "slug": obj.slug,
            "author": obj.author,
            "description": obj.description,
            "url": obj.url,
            "popularity": obj.popularity,
            "isDraft": obj.is_draft,
            "features": ([serialize(x, user) for x in features] if features else []),
            "avatar": serialize(attrs.get("avatar"), user),
        }

        if obj.metadata:
            data.update(obj.metadata)

        return data
