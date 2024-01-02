from django.urls import re_path

from .endpoints.webhook import BitbucketPluginWebhookEndpoint

urlpatterns = [
    re_path(
        r"^organizations/(?P<organization_id>[^\/]+)/webhook/$",
        BitbucketPluginWebhookEndpoint.as_view(),
        name="sentry-plugins-bitbucket-webhook",
    )
]
