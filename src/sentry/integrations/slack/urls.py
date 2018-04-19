from __future__ import absolute_import, print_function

from django.conf.urls import patterns, url

from .action_endpoint import SlackActionEndpoint
from .event_endpoint import SlackEventEndpoint
from .link_identity import SlackLinkIdentitiyView


urlpatterns = patterns(
    '',
    url(r'^action/$', SlackActionEndpoint.as_view()),
    url(r'^event/$', SlackEventEndpoint.as_view()),
    url(
        r'^link-identity/(?P<signed_params>[^\/]+)/$',
        SlackLinkIdentitiyView.as_view(),
        name='sentry-integration-slack-link-identity'
    ),
)
