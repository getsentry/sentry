from __future__ import absolute_import

from rest_framework import serializers


class AuthVerifyValidator(serializers.Serializer):
    password = serializers.CharField(required=True)
