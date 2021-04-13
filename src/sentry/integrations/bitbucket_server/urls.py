from django.conf.urls import url

from .webhook import BitbucketServerWebhookEndpoint

urlpatterns = [
    url(
        r"^organizations/(?P<organization_id>[^\/]+)/webhook/(?P<integration_id>\d+)/$",
        BitbucketServerWebhookEndpoint.as_view(),
        name="sentry-extensions-bitbucketserver-webhook",
    )
]
