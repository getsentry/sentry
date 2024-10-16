from sentry.integrations.on_call.metrics import OnCallInteractionEvent, OnCallInteractionType
from sentry.integrations.opsgenie.spec import OpsgenieOnCallSpec


def record_event(event: OnCallInteractionType):
    return OnCallInteractionEvent(event, OpsgenieOnCallSpec())
