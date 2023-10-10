from django.urls import re_path

from .views.link_identity import SlackLinkIdentityView
from .views.link_team import SlackLinkTeamView
from .views.unlink_identity import SlackUnlinkIdentityView
from .views.unlink_team import SlackUnlinkTeamView
from .webhooks.action import SlackActionEndpoint
from .webhooks.command import SlackCommandsEndpoint
from .webhooks.event import SlackEventEndpoint

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
        r"^link-identity/(?P<signed_params>[^\/]+)/$",
        SlackLinkIdentityView.as_view(),
        name="sentry-integration-slack-link-identity",
    ),
    re_path(
        r"^unlink-identity/(?P<signed_params>[^\/]+)/$",
        SlackUnlinkIdentityView.as_view(),
        name="sentry-integration-slack-unlink-identity",
    ),
    re_path(
        r"^link-team/(?P<signed_params>[^\/]+)/$",
        SlackLinkTeamView.as_view(),
        name="sentry-integration-slack-link-team",
    ),
    re_path(
        r"^unlink-team/(?P<signed_params>[^\/]+)/$",
        SlackUnlinkTeamView.as_view(),
        name="sentry-integration-slack-unlink-team",
    ),
]
