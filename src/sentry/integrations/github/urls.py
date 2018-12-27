from __future__ import absolute_import, print_function

from django.conf.urls import patterns, url

from .webhook import GitHubIntegrationsWebhookEndpoint

urlpatterns = patterns(
    '',
    url(r'^webhook/$', GitHubIntegrationsWebhookEndpoint.as_view()),
)
