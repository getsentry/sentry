from __future__ import absolute_import, print_function

from django.conf.urls import patterns, url
from .webhooks import VstsWebhook
urlpatterns = patterns(
    '',
    url(r'^webhook/$', VstsWebhook.as_view()),
)
