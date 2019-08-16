from __future__ import absolute_import

import six

from sentry.api.serializers import register, Serializer
from sentry.models import PlatformExternalIssue


@register(PlatformExternalIssue)
class PlatformExternalIssueSerializer(Serializer):
    def serialize(self, obj, attrs, user):
        return {
            "id": six.text_type(obj.id),
            "groupId": six.text_type(obj.group_id),
            "serviceType": obj.service_type,
            "displayName": obj.display_name,
            "webUrl": obj.web_url,
        }
