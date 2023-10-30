from django.urls import re_path

from .webhook import GitHubEnterpriseWebhookEndpoint

urlpatterns = [
    re_path(
        r"^webhook/$",
        GitHubEnterpriseWebhookEndpoint.as_view(),
        name="sentry-integration-github-enterprise-webhook",
    )
]
