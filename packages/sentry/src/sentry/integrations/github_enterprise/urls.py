from django.conf.urls import url

from .webhook import GitHubEnterpriseWebhookEndpoint

urlpatterns = [url(r"^webhook/$", GitHubEnterpriseWebhookEndpoint.as_view())]
