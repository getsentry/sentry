from __future__ import absolute_import, print_function

from django.conf.urls import patterns, url

from .payload import GitHubAppsEndpoint


urlpatterns = patterns(
    '',
    url(r'^payload/$', GitHubAppsEndpoint.as_view()),
)
