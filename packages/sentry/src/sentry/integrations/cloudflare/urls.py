from django.conf.urls import url

from .metadata import CloudflareMetadataEndpoint
from .webhook import CloudflareWebhookEndpoint

urlpatterns = [
    url(r"^metadata/$", CloudflareMetadataEndpoint.as_view()),
    url(r"^webhook/$", CloudflareWebhookEndpoint.as_view()),
]
