from django.conf.urls import url

from .webhooks import GitHubIntegrationsWebhookEndpoint, GithubWebhookEndpoint

urlpatterns = [
    url(r"^organizations/(?P<organization_id>[^\/]+)/webhook/$", GithubWebhookEndpoint.as_view()),
    url(r"^installations/webhook/$", GitHubIntegrationsWebhookEndpoint.as_view()),
]
