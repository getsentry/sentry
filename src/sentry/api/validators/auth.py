from __future__ import absolute_import

from rest_framework import serializers


class AuthVerifyValidator(serializers.Serializer):
    password = serializers.CharField(required=False)
    # For u2f
    challenge = serializers.CharField(required=False)
    response = serializers.CharField(required=False)
