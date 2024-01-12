from rest_framework import serializers

MISSING_PASSWORD_OR_U2F_CODE = "no_password_or_u2f"


class AuthVerifyValidator(serializers.Serializer):
    password = serializers.CharField(required=False, trim_whitespace=False)
    # For u2f
    challenge = serializers.CharField(required=False, trim_whitespace=False)
    response = serializers.CharField(required=False, trim_whitespace=False)

    def validate(self, data):
        if "password" in data:
            return data
        if "challenge" in data and "response" in data:
            return data
        raise serializers.ValidationError(
            detail="You must provide `password` or `challenge` and `response`.",
            code=MISSING_PASSWORD_OR_U2F_CODE,
        )
