from django.conf import settings

from sentry.api.serializers import Serializer, register
from social_auth.models import UserSocialAuth


def get_provider_label(obj: UserSocialAuth) -> str:
    return settings.AUTH_PROVIDER_LABELS[obj.provider]


@register(UserSocialAuth)
class UserSocialAuthSerializer(Serializer):
    def serialize(self, obj, attrs, user):
        return {
            "id": str(obj.id),
            "provider": obj.provider,
            "providerLabel": get_provider_label(obj),
        }
