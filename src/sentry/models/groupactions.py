from rest_framework.request import Request

from sentry.api.serializers.models.plugin import is_plugin_deprecated
from sentry.plugins.base import plugins
from sentry.plugins.bases.issue2 import IssueTrackingPlugin2
from sentry.utils.safe import safe_execute


def get_actions(request: Request, group):
    project = group.project

    action_list = []
    for plugin in plugins.for_project(project, version=1):
        if is_plugin_deprecated(plugin, project):
            continue

        results = safe_execute(plugin.actions, request, group, action_list, _with_transaction=False)

        if not results:
            continue

        action_list = results

    for plugin in plugins.for_project(project, version=2):
        if is_plugin_deprecated(plugin, project):
            continue
        for action in (
            safe_execute(plugin.get_actions, request, group, _with_transaction=False) or ()
        ):
            action_list.append(action)

    return action_list


def get_available_issue_plugins(request: Request, group):
    project = group.project

    plugin_issues = []
    for plugin in plugins.for_project(project, version=1):
        if isinstance(plugin, IssueTrackingPlugin2):
            if is_plugin_deprecated(plugin, project):
                continue
            plugin_issues = safe_execute(
                plugin.plugin_issues, request, group, plugin_issues, _with_transaction=False
            )
    return plugin_issues
