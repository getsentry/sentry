from typing import Any

from rest_framework import serializers

from sentry.agent_handoff.codes import OnboardingHandoffContext
from sentry.agent_handoff.flows.base import Flow, InvalidHandoffContext
from sentry.agent_handoff.runbook import render_onboarding_runbook
from sentry.api.serializers.rest_framework import CamelSnakeSerializer
from sentry.organizations.services.organization.service import organization_service


class OnboardingContextSerializer(CamelSnakeSerializer[OnboardingHandoffContext]):
    run_id = serializers.RegexField(r"^[a-f0-9]{32}$")

    def to_internal_value(self, data: Any) -> OnboardingHandoffContext:
        if isinstance(data, OnboardingHandoffContext):
            return data

        return OnboardingHandoffContext(**super().to_internal_value(data))

    def validate(self, context: OnboardingHandoffContext) -> OnboardingHandoffContext:
        if not organization_service.has_active_onboarding_run(
            organization_id=self.context["organization_id"],
            user_id=self.context["user_id"],
            run_id=context.run_id,
        ):
            raise serializers.ValidationError({"run_id": ["Onboarding run is unavailable."]})

        return context


class OnboardingFlow(Flow[OnboardingHandoffContext]):
    def get_context_serializer(self) -> type[OnboardingContextSerializer]:
        return OnboardingContextSerializer

    def render(self, context: object, *, user_id: int, organization_id: int) -> str:
        parsed = OnboardingHandoffContext.parse_obj(context)
        issued = organization_service.issue_onboarding_reporting_code(
            organization_id=organization_id, user_id=user_id, run_id=parsed.run_id
        )
        if issued is None:
            raise InvalidHandoffContext("Onboarding run is unavailable")

        return render_onboarding_runbook(run_code=issued.code)

    def preview(self) -> str:
        return render_onboarding_runbook(run_code="<onboarding-run-code>")
