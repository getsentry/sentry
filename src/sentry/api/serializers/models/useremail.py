from sentry.api.serializers import Serializer, register
from sentry.users.models.useremail import UserEmail


@register(UserEmail)
class UserEmailSerializer(Serializer):
    def serialize(self, obj, attrs, user, **kwargs):
        primary_email = UserEmail.objects.get_primary_email(user)
        return {
            "email": obj.email,
            "isPrimary": obj.email == primary_email.email,
            "isVerified": obj.is_verified,
        }
