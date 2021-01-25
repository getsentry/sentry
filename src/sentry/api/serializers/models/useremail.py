from sentry.api.serializers import Serializer, register
from sentry.models import UserEmail


@register(UserEmail)
class UserEmailSerializer(Serializer):
    def serialize(self, obj, attrs, user):
        primary_email = UserEmail.get_primary_email(user)
        return {
            "email": obj.email,
            "isPrimary": obj.email == primary_email.email,
            "isVerified": obj.is_verified,
        }
