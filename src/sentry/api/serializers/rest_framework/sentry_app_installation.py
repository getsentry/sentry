from __future__ import absolute_import


from rest_framework import serializers
from rest_framework.serializers import Serializer, ValidationError
from sentry.constants import SentryAppInstallationStatus


class SentryAppInstallationSerializer(Serializer):
    status = serializers.CharField()

    def validate_status(self, new_status):
        # can only set status to installed
        if new_status != SentryAppInstallationStatus.INSTALLED_STR:
            raise ValidationError(
                u"Invalid value '{}' for status. Valid values: '{}'".format(
                    new_status, SentryAppInstallationStatus.INSTALLED_STR
                )
            )

        return new_status
