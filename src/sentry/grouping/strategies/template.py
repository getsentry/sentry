from typing import Any

from sentry.eventstore.models import Event
from sentry.grouping.component import (
    ContextLineGroupingComponent,
    FilenameGroupingComponent,
    TemplateGroupingComponent,
)
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
    filename_component = FilenameGroupingComponent()
    if interface.filename is not None:
        filename_component.update(values=[interface.filename])

    context_line_component = ContextLineGroupingComponent()
    if interface.context_line is not None:
        context_line_component.update(values=[interface.context_line])

    return {
        context["variant"]: TemplateGroupingComponent(
            values=[filename_component, context_line_component]
        )
    }
