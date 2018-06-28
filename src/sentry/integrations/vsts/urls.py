from __future__ import absolute_import, print_function

from django.conf.urls import patterns, url
from .webhooks import WorkItemWebhook
urlpatterns = patterns(
    '',
    url(r'^webhooks/$', WorkItemWebhook.as_view(), name='sentry-extensions-vsts-issue-updated'),
)
