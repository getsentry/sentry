from __future__ import annotations

from typing import TYPE_CHECKING, Any

from sentry.grouping.component import MessageGroupingComponent
from sentry.grouping.strategies.base import (
    ComponentsByVariant,
    GroupingContext,
    produces_variants,
    strategy,
)
from sentry.grouping.utils import normalize_message_for_grouping
from sentry.interfaces.message import Message

if TYPE_CHECKING:
    from sentry.services.eventstore.models import Event


@strategy(ids=["message:v1"], interface=Message, score=0)
@produces_variants(["default"])
def message_v1(
    interface: Message, event: Event, context: GroupingContext, **kwargs: Any
) -> ComponentsByVariant:
    variant_name = context["variant_name"]

    # This is true for all but our test config
    if context["normalize_message"]:
        raw_message = interface.message or interface.formatted or ""
        normalized = normalize_message_for_grouping(
            raw_message, event, source="message_component", trim_message=True
        )
        hint = "stripped event-specific values" if raw_message != normalized else None
        return {variant_name: MessageGroupingComponent(values=[normalized], hint=hint)}
    else:
        return {
            variant_name: MessageGroupingComponent(
                values=[interface.message or interface.formatted or ""],
            )
        }
