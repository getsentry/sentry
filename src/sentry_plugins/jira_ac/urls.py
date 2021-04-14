from django.conf.urls import url

from sentry_plugins.jira_ac.views import (
    JiraConfigView,
    JiraDescriptorView,
    JiraInstalledCallback,
    JiraUIWidgetView,
)

urlpatterns = [
    url(r"^plugin$", JiraUIWidgetView.as_view()),
    url(r"^config$", JiraConfigView.as_view()),
    url(r"^atlassian-connect\.json$", JiraDescriptorView.as_view()),
    url(r"^installed$", JiraInstalledCallback.as_view()),
]
