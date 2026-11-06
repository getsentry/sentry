from collections.abc import Callable, Mapping
from enum import StrEnum

from sentry.agent_handoff.codes import HandoffFlow, OnboardingHandoffContext
from sentry.agent_handoff.runbook import render_onboarding_runbook
from sentry.organizations.services.organization.service import organization_service


class HandoffMode(StrEnum):
    CLAIMED = "claimed"
    PREVIEW = "preview"


class InvalidHandoffContext(ValueError):
    pass


def validate_flow_context(
    flow: HandoffFlow,
    *,
    context: OnboardingHandoffContext | None,
    user_id: int,
    organization_id: int,
) -> None:
    if flow is not HandoffFlow.ONBOARDING or context is None:
        return

    if not organization_service.has_active_onboarding_run(
        organization_id=organization_id, user_id=user_id, run_id=context.run_id
    ):
        raise InvalidHandoffContext("Onboarding run is unavailable")


def _guided_next_steps(
    mode: HandoffMode, user_id: int, organization_id: int, context: OnboardingHandoffContext | None
) -> str:
    return "Now ask the user what they would like to do next."


def _onboarding_instructions(
    mode: HandoffMode, user_id: int, organization_id: int, context: OnboardingHandoffContext | None
) -> str:
    if mode is HandoffMode.PREVIEW:
        return render_onboarding_runbook(
            organization_id=organization_id, code="<onboarding-run-code>"
        )

    if context is None:
        return _guided_next_steps(mode, user_id, organization_id, context)

    issued = organization_service.issue_onboarding_reporting_code(
        organization_id=organization_id, user_id=user_id, run_id=context.run_id
    )
    if issued is None:
        raise InvalidHandoffContext("Onboarding run is unavailable")
    return render_onboarding_runbook(organization_id=organization_id, code=issued.code)


_FLOW_HANDLERS: Mapping[
    HandoffFlow, Callable[[HandoffMode, int, int, OnboardingHandoffContext | None], str]
] = {
    HandoffFlow.GUIDED_NEXT_STEPS: _guided_next_steps,
    HandoffFlow.ONBOARDING: _onboarding_instructions,
}


def get_flow_instructions(
    flow: HandoffFlow,
    *,
    mode: HandoffMode,
    user_id: int,
    organization_id: int,
    context: OnboardingHandoffContext | None = None,
) -> str:
    """Render flow instructions for a claimed handoff or an authenticated preview."""
    return _FLOW_HANDLERS[flow](mode, user_id, organization_id, context)
