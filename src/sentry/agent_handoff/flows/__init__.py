from collections.abc import Mapping

from sentry.agent_handoff.codes import HandoffFlow
from sentry.agent_handoff.flows.create_project import CreateProjectFlow
from sentry.agent_handoff.flows.guided_next_steps import GuidedNextStepsFlow
from sentry.agent_handoff.flows.onboarding import OnboardingFlow

AgentHandoffFlow = CreateProjectFlow | GuidedNextStepsFlow | OnboardingFlow

_FLOWS: Mapping[HandoffFlow, AgentHandoffFlow] = {
    HandoffFlow.CREATE_PROJECT: CreateProjectFlow(),
    HandoffFlow.GUIDED_NEXT_STEPS: GuidedNextStepsFlow(),
    HandoffFlow.ONBOARDING: OnboardingFlow(),
}


def get_flow(flow: HandoffFlow) -> AgentHandoffFlow:
    return _FLOWS[flow]
