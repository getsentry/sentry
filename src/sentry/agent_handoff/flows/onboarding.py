from sentry.agent_handoff.codes import ProjectSetupContext
from sentry.agent_handoff.flows.base import Flow, InvalidHandoffContext
from sentry.agent_handoff.flows.common import ProjectSetupContextSerializer
from sentry.agent_handoff.runbook import MARKDOWN_JINJA_ENV
from sentry.organizations.services.organization.service import organization_service


class OnboardingFlow(Flow[ProjectSetupContext]):
    def get_context_serializer(self) -> type[ProjectSetupContextSerializer]:
        return ProjectSetupContextSerializer

    def render(self, context: object, *, user_id: int, organization_id: int) -> str:
        parsed = ProjectSetupContext.parse_obj(context)
        issued = organization_service.issue_onboarding_reporting_code(
            organization_id=organization_id, user_id=user_id, run_id=parsed.run_id
        )
        if issued is None:
            raise InvalidHandoffContext("Onboarding run is unavailable")

        return render_onboarding_runbook(run_code=issued.code)

    def preview(self) -> str:
        return render_onboarding_runbook(run_code="<onboarding-run-code>")


def render_onboarding_runbook(*, run_code: str) -> str:
    return MARKDOWN_JINJA_ENV.get_template("sentry/agent_handoff/onboarding.md").render(
        run_code=run_code
    )
