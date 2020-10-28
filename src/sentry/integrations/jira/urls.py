from __future__ import absolute_import, print_function

from django.conf.urls import url

from .ui_hook import JiraUiHookView
from .descriptor import JiraDescriptorEndpoint
from .installed import JiraInstalledEndpoint
from .search import JiraSearchEndpoint
from .uninstalled import JiraUninstalledEndpoint
from .webhooks import JiraIssueUpdatedWebhook
from .extension_configuration import JiraExtensionConfigurationView


urlpatterns = [
    url(r"^ui-hook/$", JiraUiHookView.as_view()),
    url(r"^descriptor/$", JiraDescriptorEndpoint.as_view()),
    url(r"^installed/$", JiraInstalledEndpoint.as_view()),
    url(r"^uninstalled/$", JiraUninstalledEndpoint.as_view()),
    url(
        r"^issue-updated/$",
        JiraIssueUpdatedWebhook.as_view(),
        name="sentry-extensions-jira-issue-updated",
    ),
    url(
        r"^search/(?P<organization_slug>[^\/]+)/(?P<integration_id>\d+)/$",
        JiraSearchEndpoint.as_view(),
        name="sentry-extensions-jira-search",
    ),
    url(r"^configure/$", JiraExtensionConfigurationView.as_view()),
]
