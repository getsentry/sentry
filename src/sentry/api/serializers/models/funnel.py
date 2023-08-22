from sentry.api.serializers import Serializer, register
from sentry.models import Funnel


@register(Funnel)
class FunnelSerializer(Serializer):
    def serialize(self, obj, attrs, user):
        return {
            "project": str(obj.project_id),
            "startingTransaction": obj.starting_transaction,
            "endingTransaction": obj.ending_transaction,
            "name": obj.name,
            "slug": obj.slug,
            "id": str(obj.id),
        }
