from __future__ import absolute_import


from rest_framework import serializers
from rest_framework.serializers import Serializer, ValidationError
from sentry.constants import SentryAppInstallationStatus


class SentryAppInstallationSerializer(Serializer):
    status = serializers.CharField()

    def validate_status(self, new_status):
        # make sure the status in in our defined list
        try:
            SentryAppInstallationStatus.STATUS_MAP[new_status]
        except KeyError:
            raise ValidationError(
                'Invalid value for status. Valid values: {}'.format(
                    SentryAppInstallationStatus.STATUS_MAP.keys(),
                ),
            )
        # convert status to str for comparison
        last_status = SentryAppInstallationStatus.as_str(self.instance.status)
        # make sure we don't go from installed to pending
        if last_status == SentryAppInstallationStatus.INSTALLED_STR and new_status == SentryAppInstallationStatus.PENDING_STR:
            raise ValidationError('Cannot change installed integration to pending')

        return new_status
