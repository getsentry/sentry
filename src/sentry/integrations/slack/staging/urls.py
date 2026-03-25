from django.urls import re_path

from sentry.integrations.slack.webhooks.action import SlackActionEndpoint
from sentry.integrations.slack.webhooks.command import SlackCommandsEndpoint
from sentry.integrations.slack.webhooks.event import SlackEventEndpoint
from sentry.integrations.slack.webhooks.options_load import SlackOptionsLoadEndpoint

urlpatterns = [
    re_path(
        r"^action/$",
        SlackActionEndpoint.as_view(),
        name="sentry-integration-slack-staging-action",
    ),
    re_path(
        r"^commands/$",
        SlackCommandsEndpoint.as_view(),
        name="sentry-integration-slack-staging-commands",
    ),
    re_path(
        r"^event/$",
        SlackEventEndpoint.as_view(),
        name="sentry-integration-slack-staging-event",
    ),
    re_path(
        r"^options-load/$",
        SlackOptionsLoadEndpoint.as_view(),
        name="sentry-integration-slack-staging-options-load",
    ),
]
