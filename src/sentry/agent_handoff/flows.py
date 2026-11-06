from collections.abc import Callable, Mapping
from enum import StrEnum

from sentry.agent_handoff.codes import HandoffFlow


class HandoffMode(StrEnum):
    CLAIMED = "claimed"
    PREVIEW = "preview"


def _guided_next_steps(mode: HandoffMode, user_id: int, organization_id: int) -> str:
    return "Now ask the user what they would like to do next."


def _onboarding_instructions(mode: HandoffMode, user_id: int, organization_id: int) -> str:
    # TODO: In CLAIMED mode, create an onboarding run through organization RPC for
    # this user and organization, and include its run code for progress reporting.
    return _guided_next_steps(mode, user_id, organization_id)


_FLOW_HANDLERS: Mapping[HandoffFlow, Callable[[HandoffMode, int, int], str]] = {
    HandoffFlow.GUIDED_NEXT_STEPS: _guided_next_steps,
    HandoffFlow.ONBOARDING: _onboarding_instructions,
}


def get_flow_instructions(
    flow: HandoffFlow, *, mode: HandoffMode, user_id: int, organization_id: int
) -> str:
    """Render flow instructions for a claimed handoff or an authenticated preview."""
    return _FLOW_HANDLERS[flow](mode, user_id, organization_id)
