from rest_framework import serializers
from rest_framework.serializers import Serializer, ValidationError

from sentry.constants import SentryAppInstallationStatus


class SentryAppInstallationParser(Serializer):
    status = serializers.CharField(
        help_text=(
            f"The new status of the installation. The only accepted value is "
            f"`{SentryAppInstallationStatus.INSTALLED_STR}`, which marks a pending "
            f"installation as installed."
        )
    )

    def validate_status(self, new_status):
        # can only set status to installed
        if new_status != SentryAppInstallationStatus.INSTALLED_STR:
            raise ValidationError(
                f"Invalid value '{new_status}' for status. Valid values: '{SentryAppInstallationStatus.INSTALLED_STR}'"
            )

        return new_status
