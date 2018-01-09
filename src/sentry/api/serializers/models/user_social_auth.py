from __future__ import absolute_import

import six

from django.conf import settings
from social_auth.models import UserSocialAuth

from sentry.api.serializers import Serializer, register


@register(UserSocialAuth)
class UserSocialAuthSerializer(Serializer):
    def serialize(self, obj, attrs, user):
        return {
            'id': six.text_type(obj.id),
            'provider': obj.provider,
            'provider_label': settings.AUTH_PROVIDER_LABELS[obj.provider],
        }
