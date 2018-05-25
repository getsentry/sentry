from __future__ import absolute_import, print_function

from django.conf.urls import patterns, url

from .webhook import GithubIntegrationsWebhookEndpoint

from .payload import GitHubAppsEndpoint

urlpatterns = patterns(
    '',
    url(r'^webhook/$', GithubIntegrationsWebhookEndpoint.as_view()),

    url(r'^payload/$', GitHubAppsEndpoint.as_view()),
)
