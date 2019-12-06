from __future__ import absolute_import

from django.conf.urls import url

from .descriptor import BitbucketDescriptorEndpoint
from .installed import BitbucketInstalledEndpoint
from .uninstalled import BitbucketUninstalledEndpoint
from .webhook import BitbucketWebhookEndpoint
from .search import BitbucketSearchEndpoint

urlpatterns = [
    url(r"^descriptor/$", BitbucketDescriptorEndpoint.as_view()),
    url(r"^installed/$", BitbucketInstalledEndpoint.as_view()),
    url(r"^uninstalled/$", BitbucketUninstalledEndpoint.as_view()),
    url(
        r"^organizations/(?P<organization_id>[^\/]+)/webhook/$", BitbucketWebhookEndpoint.as_view()
    ),
    url(
        r"^search/(?P<organization_slug>[^\/]+)/(?P<integration_id>\d+)/$",
        BitbucketSearchEndpoint.as_view(),
        name="sentry-extensions-bitbucket-search",
    ),
]
