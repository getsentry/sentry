from __future__ import absolute_import

from django.conf.urls import patterns, url
from .webhook import BitbucketServerWebhookEndpoint

urlpatterns = patterns(
    "",
    url(
        r"^organizations/(?P<organization_id>[^\/]+)/webhook/(?P<integration_id>\d+)/$",
        BitbucketServerWebhookEndpoint.as_view(),
        name="sentry-extensions-bitbucketserver-webhook",
    ),
)
