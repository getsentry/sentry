from collections.abc import Mapping

from sentry.agent_handoff.codes import HandoffFlow
from sentry.agent_handoff.flows.guided_next_steps import GuidedNextStepsFlow
from sentry.agent_handoff.flows.onboarding import OnboardingFlow

_FLOWS: Mapping[HandoffFlow, GuidedNextStepsFlow | OnboardingFlow] = {
    HandoffFlow.GUIDED_NEXT_STEPS: GuidedNextStepsFlow(),
    HandoffFlow.ONBOARDING: OnboardingFlow(),
}


def get_flow(flow: HandoffFlow) -> GuidedNextStepsFlow | OnboardingFlow:
    return _FLOWS[flow]
