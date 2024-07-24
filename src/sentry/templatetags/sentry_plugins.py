from django import template

from sentry.plugins.base import plugins
from sentry.utils.safe import safe_execute

register = template.Library()


@register.filter
def get_actions(group, request):
    project = group.project

    action_list = []
    for plugin in plugins.for_project(project, version=1):
        results = safe_execute(plugin.actions, request, group, action_list)

        if not results:
            continue

        action_list = results

    for plugin in plugins.for_project(project, version=2):
        for action in safe_execute(plugin.get_actions, request, group) or ():
            action_list.append(action)

    return [(a[0], a[1]) for a in action_list]
