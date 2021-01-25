from django import template

from sentry.plugins.base import Annotation, plugins
from sentry.utils.safe import safe_execute

register = template.Library()


@register.filter
def get_actions(group, request):
    project = group.project

    action_list = []
    for plugin in plugins.for_project(project, version=1):
        results = safe_execute(plugin.actions, request, group, action_list, _with_transaction=False)

        if not results:
            continue

        action_list = results

    for plugin in plugins.for_project(project, version=2):
        for action in (
            safe_execute(plugin.get_actions, request, group, _with_transaction=False) or ()
        ):
            action_list.append(action)

    return [(a[0], a[1]) for a in action_list]


@register.filter
def get_annotations(group, request=None):
    project = group.project

    annotation_list = []
    for plugin in plugins.for_project(project, version=2):
        for value in (
            safe_execute(plugin.get_annotations, group=group, _with_transaction=False) or ()
        ):
            annotation = safe_execute(Annotation, _with_transaction=False, **value)
            if annotation:
                annotation_list.append(annotation)

    return annotation_list
