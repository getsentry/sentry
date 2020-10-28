from __future__ import absolute_import

from rest_framework import serializers


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
            "You must provide `password` or `challenge` and `response`."
        )
