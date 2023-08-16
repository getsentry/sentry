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


def get_provider_defaults():
    # create the data structure outside the endpoint
    provider_defaults = []
    for key, value in NOTIFICATION_SETTING_DEFAULTS.items():
        provider = EXTERNAL_PROVIDERS[key]
        # if the value is NOTIFICATION_SETTINGS_ALL_SOMETIMES then it means the provider
        # is on by default
        if value == NOTIFICATION_SETTINGS_ALL_SOMETIMES:
            provider_defaults.append(provider)
    return provider_defaults


def get_type_defaults():
    # this tells us what the default value is for each notification type
    type_defaults = {}
    for key, value in NOTIFICATION_SETTINGS_ALL_SOMETIMES.items():
        # for the given notification type, figure out what the default value is
        notification_type = NOTIFICATION_SETTING_TYPES[key]
        default = NOTIFICATION_SETTING_OPTION_VALUES[value]
        type_defaults[notification_type] = default
    return type_defaults


PROVIDER_DEFAULTS = get_provider_defaults()
TYPE_DEFAULTS = get_type_defaults()


@control_silo_endpoint
class NotificationDefaultsEndpoints(Endpoint):
    permission_classes = ()
    private = True

    def get(self, request: Request) -> Response:
        """
        Return the default config for notification settings.
        This becomes the fallback in the UI.
        """
        return Response(
            {
                "providerDefaults": PROVIDER_DEFAULTS,
                "typeDefaults": TYPE_DEFAULTS,
            }
        )
