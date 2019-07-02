from __future__ import absolute_import

import six

from sentry.api.serializers import Serializer, register
from sentry.models import SavedSearch


@register(SavedSearch)
class SavedSearchSerializer(Serializer):
    def serialize(self, obj, attrs, user):
        return {
            'id': six.text_type(obj.id),
            'type': obj.type,
            'name': obj.name,
            'query': obj.query,
            'dateCreated': obj.date_added,
            'isGlobal': obj.is_global,
            'isPinned': obj.is_pinned,
            'isOrgCustom': obj.is_org_custom_search,
        }
