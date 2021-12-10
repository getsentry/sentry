from typing import Any, Mapping

from sentry.api.serializers import Serializer, register, serialize

# from sentry.api.validators.doc_integration import METADATA_TYPES
from sentry.models import DocIntegration
from sentry.models.integrationfeature import IntegrationFeature, IntegrationTypes
from sentry.models.user import User
from sentry.utils.compat import map
from sentry.utils.json import JSONData


@register(DocIntegration)
class DocIntegrationSerializer(Serializer):
    def serialize(
        self,
        obj: DocIntegration,
        attrs: Mapping[str, Any],
        user: User,
        **kwargs: Any,
    ) -> JSONData:
        data = {
            "name": obj.name,
            "author": obj.author,
            "description": obj.description,
            "docUrl": obj.url,
            "popularity": obj.popularity,
            "isDraft": obj.is_draft,
        }

        if obj.metadata:
            #  TODO(Leander): Fix imports here
            for metadata_type in ["resources"]:
                data[metadata_type] = obj.metadata.get("metadata_type")

        features = IntegrationFeature.objects.filter(
            target_type=IntegrationTypes.DOC_INTEGRATION.value, target_id=obj.id
        )
        data["features"] = map(lambda x: serialize(x, user), features)
        return data
