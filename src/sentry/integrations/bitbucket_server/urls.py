from django.urls import re_path

from .webhook import BitbucketServerWebhookEndpoint

urlpatterns = [
    re_path(
        r"^organizations/(?P<organization_id>[^\/]+)/webhook/(?P<integration_id>\d+)/$",
        BitbucketServerWebhookEndpoint.as_view(),
        name="sentry-extensions-bitbucketserver-webhook",
    )
]
