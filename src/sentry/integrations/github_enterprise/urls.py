from __future__ import absolute_import, print_function

from django.conf.urls import patterns, url

from .webhook import GitHubEnterpriseWebhookEndpoint


urlpatterns = patterns(
    '',
    url(r'^webhook/$', GitHubEnterpriseWebhookEndpoint.as_view()),
)
