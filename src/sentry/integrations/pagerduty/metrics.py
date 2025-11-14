from typing import int
from sentry.integrations.on_call.metrics import OnCallInteractionEvent, OnCallInteractionType
from sentry.integrations.on_call.spec import PagerDutyOnCallSpec


def record_event(event: OnCallInteractionType) -> OnCallInteractionEvent:
    return OnCallInteractionEvent(event, PagerDutyOnCallSpec())
