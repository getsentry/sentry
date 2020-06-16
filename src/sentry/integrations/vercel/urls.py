from __future__ import absolute_import, print_function

from django.conf.urls import url

from .webhook import VercelWebhookEndpoint


urlpatterns = [
    url(r"^webhook/$", VercelWebhookEndpoint.as_view()),
]
