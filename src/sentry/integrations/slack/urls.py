from __future__ import absolute_import, print_function

from django.conf.urls import patterns, url

from .action_endpoint import SlackActionEndpoint
from .event_endpoint import SlackEventEndpoint


urlpatterns = patterns(
    '',
    url(r'^action/$', SlackActionEndpoint.as_view()),
    url(r'^event/$', SlackEventEndpoint.as_view()),
)
