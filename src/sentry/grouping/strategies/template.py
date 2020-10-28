from __future__ import absolute_import

from sentry.grouping.component import GroupingComponent
from sentry.grouping.strategies.base import strategy


@strategy(id="template:v1", interfaces=["template"], variants=["default"], score=1100)
def template_v1(template, **meta):
    filename_component = GroupingComponent(id="filename")
    if template.filename is not None:
        filename_component.update(values=[template.filename])

    context_line_component = GroupingComponent(id="context-line")
    if template.context_line is not None:
        context_line_component.update(values=[template.context_line])

    return GroupingComponent(id="template", values=[filename_component, context_line_component])
