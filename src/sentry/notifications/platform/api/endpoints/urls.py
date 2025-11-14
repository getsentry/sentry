from typing import int
from django.urls import re_path

from sentry.notifications.platform.api.endpoints.internal_registered_templates import (
    InternalRegisteredTemplatesEndpoint,
)

internal_urlpatterns = [
    re_path(
        r"^notifications/registered-templates/$",
        InternalRegisteredTemplatesEndpoint.as_view(),
        name="internal-notifications-registered-templates",
    ),
]
