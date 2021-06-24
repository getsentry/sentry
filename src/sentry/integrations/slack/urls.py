from django.conf.urls import url

from .action_endpoint import SlackActionEndpoint
from .command_endpoint import SlackCommandsEndpoint
from .event_endpoint import SlackEventEndpoint
from .link_identity import SlackLinkIdentityView
from .link_team import SlackLinkTeamView
from .unlink_identity import SlackUnlinkIdentityView

urlpatterns = [
    url(r"^action/$", SlackActionEndpoint.as_view()),
    url(r"^commands/$", SlackCommandsEndpoint.as_view(), name="sentry-integration-slack-commands"),
    url(r"^event/$", SlackEventEndpoint.as_view()),
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
]
