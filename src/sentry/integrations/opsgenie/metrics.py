from typing import int
from sentry.integrations.on_call.metrics import OnCallInteractionEvent, OnCallInteractionType
from sentry.integrations.on_call.spec import OpsgenieOnCallSpec
from sentry.integrations.utils.metrics import EventLifecycle
from sentry.shared_integrations.exceptions import ApiError, ApiRateLimitedError, ApiUnauthorized


def record_event(event: OnCallInteractionType) -> OnCallInteractionEvent:
    return OnCallInteractionEvent(event, OpsgenieOnCallSpec())


# 40301 - To perform this action, use an API key from an API integration.
OPSGENIE_HALT_ERRORS = (40301,)


def record_lifecycle_termination_level(lifecycle: EventLifecycle, error: ApiError) -> None:
    if isinstance(error, (ApiUnauthorized, ApiRateLimitedError)):
        lifecycle.record_halt(halt_reason=error)
    elif error.json:
        if error.json.get("code") in OPSGENIE_HALT_ERRORS:
            lifecycle.record_halt(error)
        else:
            lifecycle.record_failure(error)
    else:
        lifecycle.record_failure(error)
