from django.urls import re_path

from .spec import SlackMessagingSpec
from .webhooks.action import SlackActionEndpoint
from .webhooks.command import SlackCommandsEndpoint
from .webhooks.event import SlackEventEndpoint
from .webhooks.options_load import SlackOptionsLoadEndpoint

urlpatterns = [
    re_path(
        r"^action/$",
        SlackActionEndpoint.as_view(),
        name="sentry-integration-slack-action",
    ),
    re_path(
        r"^commands/$",
        SlackCommandsEndpoint.as_view(),
        name="sentry-integration-slack-commands",
    ),
    re_path(
        r"^event/$",
        SlackEventEndpoint.as_view(),
        name="sentry-integration-slack-event",
    ),
    re_path(
        r"^options-load/$",
        SlackOptionsLoadEndpoint.as_view(),
        name="sentry-integration-slack-options-load",
    ),
]

urlpatterns += SlackMessagingSpec().get_identity_view_set_url_patterns()
