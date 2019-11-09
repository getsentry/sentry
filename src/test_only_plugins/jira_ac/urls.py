from __future__ import absolute_import

from django.conf.urls import patterns, url

from test_only_plugins.jira_ac.views import (
    JiraConfigView,
    JiraDescriptorView,
    JiraInstalledCallback,
    JiraUIWidgetView,
)

urlpatterns = patterns(
    "",
    url(r"^plugin$", JiraUIWidgetView.as_view()),
    url(r"^config$", JiraConfigView.as_view()),
    url(r"^atlassian-connect\.json$", JiraDescriptorView.as_view()),
    url(r"^installed$", JiraInstalledCallback.as_view()),
)
