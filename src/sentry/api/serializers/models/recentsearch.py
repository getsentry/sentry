from __future__ import absolute_import

import six

from sentry.api.serializers import Serializer, register
from sentry.models.recentsearch import RecentSearch


@register(RecentSearch)
class RecentSearchSerializer(Serializer):
    def serialize(self, obj, attrs, user):
        return {
            "id": six.text_type(obj.id),
            "organizationId": six.text_type(obj.organization_id),
            "type": obj.type,
            "query": obj.query,
            "lastSeen": obj.last_seen,
            "dateCreated": obj.date_added,
        }
