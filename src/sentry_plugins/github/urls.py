from django.urls import re_path

from .webhooks import GithubPluginIntegrationsWebhookEndpoint, GithubPluginWebhookEndpoint

urlpatterns = [
    re_path(
        r"^organizations/(?P<organization_id>[^\/]+)/webhook/$",
        GithubPluginWebhookEndpoint.as_view(),
    ),
    re_path(
        r"^installations/webhook/$",
        GithubPluginIntegrationsWebhookEndpoint.as_view(),
    ),
]
