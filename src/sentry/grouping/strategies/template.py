from typing import Any

from sentry.eventstore.models import Event
from sentry.grouping.component import GroupingComponent
from sentry.grouping.strategies.base import (
    GroupingContext,
    ReturnedVariants,
    produces_variants,
    strategy,
)
from sentry.interfaces.template import Template


@strategy(ids=["template:v1"], interface=Template, score=1100)
@produces_variants(["default"])
def template_v1(
    interface: Template, event: Event, context: GroupingContext, **meta: Any
) -> ReturnedVariants:
    filename_component = GroupingComponent(id="filename")
    if interface.filename is not None:
        filename_component.update(values=[interface.filename])

    context_line_component = GroupingComponent(id="context-line")
    if interface.context_line is not None:
        context_line_component.update(values=[interface.context_line])

    return {
        context["variant"]: GroupingComponent(
            id="template", values=[filename_component, context_line_component]
        )
    }
