from __future__ import absolute_import, print_function

from django.conf.urls import patterns, url

from .event_endpoint import SlackEventEndpoint


urlpatterns = patterns(
    '',
    url(r'^event/$', SlackEventEndpoint.as_view()),
)
