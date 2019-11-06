from __future__ import absolute_import

from django.conf.urls import patterns, url

from .endpoints.webhook import BitbucketWebhookEndpoint

urlpatterns = patterns(
    "",
    url(
        r"^organizations/(?P<organization_id>[^\/]+)/webhook/$", BitbucketWebhookEndpoint.as_view()
    ),
)
