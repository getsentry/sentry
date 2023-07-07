from django.urls import re_path

from .descriptor import BitbucketDescriptorEndpoint
from .installed import BitbucketInstalledEndpoint
from .search import BitbucketSearchEndpoint
from .uninstalled import BitbucketUninstalledEndpoint
from .webhook import BitbucketWebhookEndpoint

urlpatterns = [
    re_path(
        r"^descriptor/$",
        BitbucketDescriptorEndpoint.as_view(),
    ),
    re_path(
        r"^installed/$",
        BitbucketInstalledEndpoint.as_view(),
    ),
    re_path(
        r"^uninstalled/$",
        BitbucketUninstalledEndpoint.as_view(),
    ),
    re_path(
        r"^organizations/(?P<organization_id>[^\/]+)/webhook/$",
        BitbucketWebhookEndpoint.as_view(),
        name="sentry-extensions-bitbucket-webhook",
    ),
    re_path(
        r"^search/(?P<organization_slug>[^\/]+)/(?P<integration_id>\d+)/$",
        BitbucketSearchEndpoint.as_view(),
        name="sentry-extensions-bitbucket-search",
    ),
]
