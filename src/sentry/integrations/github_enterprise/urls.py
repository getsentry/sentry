from __future__ import absolute_import, print_function

from django.conf.urls import patterns, url

from .payload import GitHubEnterpriseAppsEndpoint


urlpatterns = patterns(
    '',
    url(r'^payload/$', GitHubEnterpriseAppsEndpoint.as_view()),
)
