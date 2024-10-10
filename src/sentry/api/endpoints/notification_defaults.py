from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import Endpoint, control_silo_endpoint
from sentry.notifications.defaults import (
    DEFAULT_ENABLED_PROVIDERS,
    NOTIFICATION_SETTINGS_TYPE_DEFAULTS,
)


@control_silo_endpoint
class NotificationDefaultsEndpoints(Endpoint):
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }
    owner = ApiOwner.ALERTS_NOTIFICATIONS
    permission_classes = ()

    def get(self, request: Request) -> Response:
        """
        Return the default config for notification settings.
        This becomes the fallback in the UI.
        """
        return Response(
            {
                "providerDefaults": [provider.value for provider in DEFAULT_ENABLED_PROVIDERS],
                "typeDefaults": {
                    type.value: default.value
                    for type, default in NOTIFICATION_SETTINGS_TYPE_DEFAULTS.items()
                },
            }
        )
