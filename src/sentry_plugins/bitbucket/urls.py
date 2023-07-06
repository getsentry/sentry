from django.urls import re_path

from .endpoints.webhook import BitbucketWebhookEndpoint

urlpatterns = [
    re_path(
        r"^organizations/(?P<organization_id>[^\/]+)/webhook/$",
        BitbucketWebhookEndpoint.as_view(),
    )
]
