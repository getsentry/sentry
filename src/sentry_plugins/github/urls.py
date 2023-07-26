from django.urls import re_path

from .webhooks import GithubIntegrationsWebhookEndpoint, GithubWebhookEndpoint

urlpatterns = [
    re_path(
        r"^organizations/(?P<organization_id>[^\/]+)/webhook/$",
        GithubWebhookEndpoint.as_view(),
    ),
    re_path(
        r"^installations/webhook/$",
        GithubIntegrationsWebhookEndpoint.as_view(),
    ),
]
