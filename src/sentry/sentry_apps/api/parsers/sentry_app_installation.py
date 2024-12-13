from rest_framework import serializers
from rest_framework.serializers import Serializer, ValidationError

from sentry.constants import SentryAppInstallationStatus
from sentry.sentry_apps.utils.errors import SentryAppError


class SentryAppInstallationParser(Serializer):
    status = serializers.CharField()

    def validate_status(self, new_status):
        # can only set status to installed
        if new_status != SentryAppInstallationStatus.INSTALLED_STR:
            raise SentryAppError(
                ValidationError(
                    f"Invalid value '{new_status}' for status. Valid values: '{SentryAppInstallationStatus.INSTALLED_STR}'"
                )
            )

        return new_status
