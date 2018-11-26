from __future__ import absolute_import
from django.conf.urls import patterns, url

from .webhooks import JiraIssueUpdatedWebhook

urlpatterns = patterns(
    '',
    url(
        r'^issue-updated/(?P<token>[^\/]+)/$',
        JiraIssueUpdatedWebhook.as_view(),
        name='sentry-extensions-jiraserver-issue-updated'
    ),
)
