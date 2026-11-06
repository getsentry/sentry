from collections.abc import Callable, Mapping

from sentry.agent_handoff.codes import AgentHandoff, HandoffFlow


def _guided_next_steps(handoff: AgentHandoff) -> str:
    return "Now ask the user what they would like to do next."


def _onboarding_instructions(handoff: AgentHandoff) -> str:
    # TODO: Create an onboarding run through organization RPC for this handoff's user
    # and organization, and include its run code in the guide for progress reporting.
    return _guided_next_steps(handoff)


_FLOW_HANDLERS: Mapping[HandoffFlow, Callable[[AgentHandoff], str]] = {
    HandoffFlow.GUIDED_NEXT_STEPS: _guided_next_steps,
    HandoffFlow.ONBOARDING: _onboarding_instructions,
}


def get_flow_instructions(handoff: AgentHandoff) -> str:
    """Run the selected flow after the handoff's authorization has been revalidated."""
    return _FLOW_HANDLERS[handoff.flow](handoff)
