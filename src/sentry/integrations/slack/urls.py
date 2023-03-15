from django.conf.urls import url

from .views.link_identity import SlackLinkIdentityView
from .views.link_team import SlackLinkTeamView
from .views.unlink_identity import SlackUnlinkIdentityView
from .views.unlink_team import SlackUnlinkTeamView
from .webhooks.action import SlackActionEndpoint
from .webhooks.command import SlackCommandsEndpoint
from .webhooks.event import SlackEventEndpoint

urlpatterns = [
    url(
        r"^action/$",
        SlackActionEndpoint.as_view(),
    ),
    url(
        r"^commands/$",
        SlackCommandsEndpoint.as_view(),
        name="sentry-integration-slack-commands",
    ),
    url(
        r"^event/$",
        SlackEventEndpoint.as_view(),
    ),
    url(
        r"^link-identity/(?P<signed_params>[^\/]+)/$",
        SlackLinkIdentityView.as_view(),
        name="sentry-integration-slack-link-identity",
    ),
    url(
        r"^unlink-identity/(?P<signed_params>[^\/]+)/$",
        SlackUnlinkIdentityView.as_view(),
        name="sentry-integration-slack-unlink-identity",
    ),
    url(
        r"^link-team/(?P<signed_params>[^\/]+)/$",
        SlackLinkTeamView.as_view(),
        name="sentry-integration-slack-link-team",
    ),
    url(
        r"^unlink-team/(?P<signed_params>[^\/]+)/$",
        SlackUnlinkTeamView.as_view(),
        name="sentry-integration-slack-unlink-team",
    ),
]
