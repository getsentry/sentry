from __future__ import absolute_import

import six

from sentry.api.serializers import Serializer, register, serialize
from sentry.models import OrganizationAccessRequest


@register(OrganizationAccessRequest)
class OrganizationAccessRequestSerializer(Serializer):
    def serialize(self, obj, attrs, user):
        d = {
            "id": six.text_type(obj.id),
            "member": serialize(obj.member),
            "team": serialize(obj.team),
            "requester": serialize(obj.requester),
        }
        return d
