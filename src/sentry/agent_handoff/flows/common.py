from typing import Any

from rest_framework import serializers

from sentry.agent_handoff.codes import ProjectSetupContext
from sentry.api.serializers.rest_framework import CamelSnakeSerializer
from sentry.organizations.services.organization.service import organization_service


class ProjectSetupContextSerializer(CamelSnakeSerializer[ProjectSetupContext]):
    run_id = serializers.RegexField(r"^[a-f0-9]{32}$")

    def to_internal_value(self, data: Any) -> ProjectSetupContext:
        if isinstance(data, ProjectSetupContext):
            return data

        return ProjectSetupContext(**super().to_internal_value(data))

    def validate(self, context: ProjectSetupContext) -> ProjectSetupContext:
        if not organization_service.has_active_onboarding_run(
            organization_id=self.context["organization_id"],
            user_id=self.context["user_id"],
            run_id=context.run_id,
        ):
            raise serializers.ValidationError({"run_id": ["Onboarding run is unavailable."]})

        return context
