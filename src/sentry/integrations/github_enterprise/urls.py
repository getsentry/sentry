from django.urls import re_path

from .webhook import GitHubEnterpriseGitHubComWebhookEndpoint, GitHubEnterpriseWebhookEndpoint

urlpatterns = [
    re_path(
        r"^webhook/$",
        GitHubEnterpriseWebhookEndpoint.as_view(),
        name="sentry-integration-github-enterprise-webhook",
    ),
    re_path(
        r"^webhook/github-com/$",
        GitHubEnterpriseGitHubComWebhookEndpoint.as_view(),
        name="sentry-integration-github-enterprise-github-com-webhook",
    ),
]
