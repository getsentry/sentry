from __future__ import absolute_import

from sentry.api.serializers import Serializer, register
from sentry.models import ExportedData


@register(ExportedData)
class ExportedDataSerializer(Serializer):
    def serialize(self, obj, attrs, user, **kwargs):
        return {
            "id": obj.id,
            # "user": 1,
            # "organization": 2,
            "dateCreated": obj.date_added,
            "dateFinished": obj.date_finished,
            "dateExpired": obj.date_expired,
            "storageUrl": obj.storage_url,
            "query": {"type": obj.query_type},
        }
