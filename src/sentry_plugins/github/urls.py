from django.conf.urls import url

from .webhooks import GitHubIntegrationsWebhookEndpoint, GitHubWebhookEndpoint

urlpatterns = [
    url(
        r"^organizations/(?P<organization_id>[^\/]+)/webhook/$",
        GitHubWebhookEndpoint.as_view(),
    ),
    url(
        r"^installations/webhook/$",
        GitHubIntegrationsWebhookEndpoint.as_view(),
    ),
]
