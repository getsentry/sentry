from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.base import Endpoint, control_silo_endpoint
from sentry.notifications.defaults import (
    NOTIFICATION_SETTING_DEFAULTS,
    NOTIFICATION_SETTINGS_ALL_SOMETIMES,
)
from sentry.notifications.types import (
    NOTIFICATION_SETTING_OPTION_VALUES,
    NOTIFICATION_SETTING_TYPES,
)
from sentry.types.integrations import EXTERNAL_PROVIDERS


@control_silo_endpoint
class NotificationDefaultsEndpoints(Endpoint):
    permission_classes = ()

    def get(self, request: Request) -> Response:
        """
        Return the default config for notification settings.
        This becomes the fallback in the UI.
        """
        provider_defaults = []
        for key, value in NOTIFICATION_SETTING_DEFAULTS.items():
            provider = EXTERNAL_PROVIDERS[key]
            if value == NOTIFICATION_SETTINGS_ALL_SOMETIMES:
                provider_defaults.append(provider)

        type_defaults = {}
        for key, value in NOTIFICATION_SETTINGS_ALL_SOMETIMES.items():
            notification_type = NOTIFICATION_SETTING_TYPES[key]
            default = NOTIFICATION_SETTING_OPTION_VALUES[value]
            type_defaults[notification_type] = default
        return Response(
            {
                "providerDefaults": provider_defaults,
                "typeDefaults": type_defaults,
            }
        )
