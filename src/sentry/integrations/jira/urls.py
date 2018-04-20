from __future__ import absolute_import, print_function

from django.conf.urls import patterns, url

from .descriptor import JiraDescriptorEndpoint
from .installed import JiraInstalledEndpoint


urlpatterns = patterns(
    '',
    url(r'^descriptor/$', JiraDescriptorEndpoint.as_view()),
    url(r'^installed/$', JiraInstalledEndpoint.as_view()),
)
