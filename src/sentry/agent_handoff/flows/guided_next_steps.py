from sentry.agent_handoff.flows.base import Flow


class GuidedNextStepsFlow(Flow[None]):
    def render(self, context: object, *, user_id: int, organization_id: int) -> str:
        return self.preview()

    def preview(self) -> str:
        return "Now ask the user what they would like to do next."
