from __future__ import absolute_import

from datetime import timedelta
from django.utils import timezone
from sentry.api.serializers import Serializer, register
from sentry.models import ApiApplication


@register(ApiApplication)
class ApiApplicationSerializer(Serializer):
    def serialize(self, obj, attrs, user):
        has_secret = obj.date_added > timezone.now() - timedelta(hours=1)
        return {
            'id': obj.client_id,
            'clientID': obj.client_id,
            'clientSecret': obj.client_secret if has_secret else None,
            'name': obj.name,
            'allowedOrigins': obj.get_allowed_origins(),
            'redirectUris': [o for o in obj.redirect_uris.splitlines() if o],
        }
