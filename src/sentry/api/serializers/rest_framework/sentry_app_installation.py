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
                    new_status, SentryAppInstallationStatus.INSTALLED_STR))

        if self.instance:
            # convert status to str for comparison
            last_status = SentryAppInstallationStatus.as_str(self.instance.status)
            # make sure we don't go from installed to pending
            if last_status == SentryAppInstallationStatus.INSTALLED_STR and new_status == SentryAppInstallationStatus.PENDING_STR:
                raise ValidationError('Cannot change installed integration to pending')

        return new_status
