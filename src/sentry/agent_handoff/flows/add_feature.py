from typing import Any

from rest_framework import serializers

from sentry.agent_handoff.codes import AddFeatureContext, AddFeatureProduct
from sentry.agent_handoff.flows.base import Flow, InvalidHandoffContext
from sentry.agent_handoff.runbook import MARKDOWN_JINJA_ENV, escape_label
from sentry.api.serializers.rest_framework import CamelSnakeSerializer
from sentry.auth import access
from sentry.constants import ObjectStatus
from sentry.organizations.services.organization.service import organization_service
from sentry.projects.services.project import project_service
from sentry.projects.services.project.model import RpcProject


def get_accessible_project(
    *, organization_id: int, user_id: int, project_id: int
) -> RpcProject | None:
    """Return the project if it's active and the user can see it, else None."""
    project = project_service.get_by_id(organization_id=organization_id, id=project_id)
    if project is None or project.status != ObjectStatus.ACTIVE:
        return None

    context = organization_service.get_access_context(
        organization_id=organization_id, user_id=user_id
    )
    if context is None or context.member is None:
        return None

    user_access = access.from_rpc_member(context)
    if user_access.has_global_access or project.id in user_access.accessible_project_ids:
        return project
    return None


class AddFeatureContextSerializer(CamelSnakeSerializer[AddFeatureContext]):
    product = serializers.ChoiceField(choices=list(AddFeatureProduct))
    project_id = serializers.IntegerField(min_value=1)

    def to_internal_value(self, data: Any) -> AddFeatureContext:
        if isinstance(data, AddFeatureContext):
            return data

        return AddFeatureContext(**super().to_internal_value(data))

    def validate(self, context: AddFeatureContext) -> AddFeatureContext:
        project = get_accessible_project(
            organization_id=self.context["organization_id"],
            user_id=self.context["user_id"],
            project_id=context.project_id,
        )
        if project is None:
            raise serializers.ValidationError({"project_id": ["Project is unavailable."]})
        return context


class AddFeatureFlow(Flow[AddFeatureContext]):
    def get_context_serializer(self) -> type[AddFeatureContextSerializer]:
        return AddFeatureContextSerializer

    def render(self, context: object, *, user_id: int, organization_id: int) -> str:
        parsed = AddFeatureContext.parse_obj(context)
        project = get_accessible_project(
            organization_id=organization_id,
            user_id=user_id,
            project_id=parsed.project_id,
        )
        if project is None:
            raise InvalidHandoffContext("Project is unavailable")
        return render_add_feature_runbook(product=parsed.product, project_slug=project.slug)

    def preview(self) -> str:
        return render_add_feature_runbook(
            product=AddFeatureProduct.TRACING,
            project_slug="example-project",
        )


def render_add_feature_runbook(*, product: AddFeatureProduct, project_slug: str) -> str:
    return MARKDOWN_JINJA_ENV.get_template("sentry/agent_handoff/add_feature.md").render(
        product=product,
        project_slug=escape_label(project_slug),
    )
