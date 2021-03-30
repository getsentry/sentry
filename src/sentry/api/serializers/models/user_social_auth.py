from django.conf import settings

from sentry.api.serializers import Serializer, register
from social_auth.models import UserSocialAuth


@register(UserSocialAuth)
class UserSocialAuthSerializer(Serializer):
    def serialize(self, obj, attrs, user):
        return {
            "id": str(obj.id),
            "provider": obj.provider,
            "providerLabel": settings.AUTH_PROVIDER_LABELS[obj.provider],
        }
