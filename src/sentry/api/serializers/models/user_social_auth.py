from django.conf import settings
from social_auth.models import UserSocialAuth

from sentry.api.serializers import Serializer, register


@register(UserSocialAuth)
class UserSocialAuthSerializer(Serializer):
    def serialize(self, obj, attrs, user):
        return {
            "id": str(obj.id),
            "provider": obj.provider,
            "providerLabel": settings.AUTH_PROVIDER_LABELS[obj.provider],
        }
