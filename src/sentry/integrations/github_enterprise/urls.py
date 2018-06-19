from __future__ import absolute_import, print_function

from django.conf.urls import patterns, url

from .webhook import GithubEnterpriseWebhookEndpoint


urlpatterns = patterns(
    '',
    url(r'^webhook/$', GithubEnterpriseWebhookEndpoint.as_view()),
)
