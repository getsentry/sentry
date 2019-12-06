from __future__ import absolute_import

from django.conf.urls import url

from .endpoints.webhook import GithubIntegrationsWebhookEndpoint, GithubWebhookEndpoint

urlpatterns = [
    url(r"^organizations/(?P<organization_id>[^\/]+)/webhook/$", GithubWebhookEndpoint.as_view()),
    url(r"^installations/webhook/$", GithubIntegrationsWebhookEndpoint.as_view()),
]
