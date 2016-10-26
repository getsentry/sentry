from __future__ import absolute_import

import six

from sentry.api.serializers import Serializer, register
from sentry.models import ApiApplication


@register(ApiApplication)
class ApiApplicationSerializer(Serializer):
    def serialize(self, obj, attrs, user):
        return {
            'id': six.text_type(obj.id),
            'clientID': obj.client_id,
            'name': obj.name,
            'allowedOrigins': obj.get_allowed_origins(),
            'redirectUris': [o for o in obj.redirect_uris.splitlines() if o],
            'grantType': obj.get_grant_type_display(),
        }
