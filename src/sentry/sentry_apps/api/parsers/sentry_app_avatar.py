from rest_framework import serializers
from rest_framework.serializers import Serializer

from sentry.api.fields.avatar import AvatarField
from sentry.utils.avatar import is_black_alpha_only


class SentryAppAvatarParser(Serializer):
    avatar_photo = AvatarField(required=False, is_sentry_app=True)
    avatar_type = serializers.ChoiceField(choices=(("default", "default"), ("upload", "upload")))
    color = serializers.BooleanField(required=True)

    def validate(self, attrs):
        attrs = super().validate(attrs)

        if attrs.get("avatar_type") == "upload" and not attrs.get("avatar_photo"):
            raise serializers.ValidationError({"avatar_photo": "A logo is required."})

        if (
            not attrs.get("color")
            and attrs.get("avatar_type") == "upload"
            and not is_black_alpha_only(attrs.get("avatar_photo"))
        ):
            raise serializers.ValidationError(
                {
                    "avatar_photo": "The icon must only use black and should contain an alpha channel."
                }
            )

        return attrs
