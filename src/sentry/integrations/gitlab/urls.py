from __future__ import absolute_import, print_function

from django.conf.urls import patterns, url

from .search import GitlabIssueSearchEndpoint
from .webhooks import GitlabWebhookEndpoint

urlpatterns = patterns(
    '',
    url(
        r'^search/(?P<organization_slug>[^\/]+)/(?P<integration_id>\d+)/$',
        GitlabIssueSearchEndpoint.as_view(),
        name='sentry-extensions-gitlab-search'
    ),
    url(
        r'^webhook/$',
        GitlabWebhookEndpoint.as_view(),
        name='sentry-extensions-gitlab-webhook'
    ),
)
