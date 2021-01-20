from django.conf.urls import url

from .endpoints.webhook import BitbucketWebhookEndpoint

urlpatterns = [
    url(r"^organizations/(?P<organization_id>[^\/]+)/webhook/$", BitbucketWebhookEndpoint.as_view())
]
