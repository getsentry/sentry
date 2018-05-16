from __future__ import absolute_import, print_function

from django.conf.urls import patterns, url

from .configure import JiraConfigureView
from .descriptor import JiraDescriptorEndpoint
from .installed import JiraInstalledEndpoint
from .search import JiraSearchEndpoint


urlpatterns = patterns(
    '',
    url(r'^configure/$', JiraConfigureView.as_view()),
    url(r'^descriptor/$', JiraDescriptorEndpoint.as_view()),
    url(r'^installed/$', JiraInstalledEndpoint.as_view()),
    url(r'^search/(?P<organization_slug>[^\/]+)/(?P<integration_id>[^\/]+)/$',
        JiraSearchEndpoint.as_view(),
        name='sentry-extensions-jira-search'
        ),
)
