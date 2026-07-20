from __future__ import annotations

from collections.abc import Mapping, Sequence
from typing import Any, TypedDict, cast

from django.http.request import HttpRequest
from django.utils.translation import gettext_lazy as _
from rest_framework.fields import CharField, ListField

from sentry.api.serializers.rest_framework.base import CamelSnakeSerializer
from sentry.integrations.base import (
    FeatureDescription,
    IntegrationData,
    IntegrationFeatures,
    IntegrationInstallation,
    IntegrationMetadata,
    IntegrationProvider,
)
from sentry.integrations.errors import OrganizationIntegrationNotFound
from sentry.integrations.gcp.utils import generate_sentry_sa, validate_gcp_project_id
from sentry.integrations.models.integration import Integration
from sentry.integrations.models.organization_integration import OrganizationIntegration
from sentry.integrations.pipeline import IntegrationPipeline
from sentry.integrations.types import IntegrationProviderSlug
from sentry.organizations.services.organization import RpcOrganization
from sentry.pipeline.types import PipelineStepResult
from sentry.pipeline.views.base import ApiPipelineSteps
from sentry.shared_integrations.exceptions import IntegrationConfigurationError

DESCRIPTION = """
Connect your Google Cloud Platform projects so Seer can pull in infrastructure
telemetry via GCP's MCP endpoints — shared across everyone in your organization.
"""

FEATURES = [
    FeatureDescription(
        "Give Seer access to your GCP telemetry while investigating issues.",
        IntegrationFeatures.MONITORING,
    ),
]

metadata = IntegrationMetadata(
    description=DESCRIPTION.strip(),
    features=FEATURES,
    author="The Sentry Team",
    noun=_("Organization"),
    issue_url="https://github.com/getsentry/sentry/issues/new?assignees=&labels=Component:%20Integrations&template=bug.yml&title=GCP%20Integration%20Problem",
    source_url="https://github.com/getsentry/sentry/tree/master/src/sentry/integrations/gcp",
    aspects={},
)


class GcpConfig(TypedDict):
    sentry_sa_email: str
    customer_sa_email: str
    projects: list[str]


class GcpConfigInputSerializer(CamelSnakeSerializer["GcpConfigInput"]):
    customer_sa_email = CharField(required=True, max_length=255)
    projects = ListField(child=CharField(max_length=64), required=True, min_length=1)


class GcpConfigInput(TypedDict):
    customer_sa_email: str
    projects: list[str]


class GcpSaGenerationApiStep:
    step_name = "gcp_sa_generation"

    def get_step_data(self, pipeline: IntegrationPipeline, request: HttpRequest) -> dict[str, Any]:
        assert pipeline.organization is not None
        sentry_sa_email = generate_sentry_sa(pipeline.organization.id)
        pipeline.bind_state("sentry_sa_email", sentry_sa_email)
        return {"sentrySaEmail": sentry_sa_email}

    def get_serializer_cls(self) -> type | None:
        return None

    def handle_post(
        self,
        validated_data: Any,
        pipeline: IntegrationPipeline,
        request: HttpRequest,
    ) -> PipelineStepResult:
        return PipelineStepResult.advance()


class GcpCustomerConfigApiStep:
    step_name = "gcp_customer_config"

    def get_step_data(self, pipeline: IntegrationPipeline, request: HttpRequest) -> dict[str, Any]:
        return {}

    def get_serializer_cls(self) -> type:
        return GcpConfigInputSerializer

    def handle_post(
        self,
        validated_data: GcpConfigInput,
        pipeline: IntegrationPipeline,
        request: HttpRequest,
    ) -> PipelineStepResult:
        pipeline.bind_state("config", dict(validated_data))
        return PipelineStepResult.advance()


class GcpIntegration(IntegrationInstallation):
    @property
    def gcp_config(self) -> GcpConfig | None:
        try:
            org_integration = self.org_integration
        except OrganizationIntegrationNotFound:
            return None
        config = org_integration.config
        if not config:
            return None
        return cast(GcpConfig, config)

    def get_organization_config(self) -> Sequence[Any]:
        return []

    def get_client(self) -> Any:
        raise NotImplementedError


class GcpIntegrationProvider(IntegrationProvider):
    key = IntegrationProviderSlug.GCP.value
    name = "Google Cloud Platform"
    metadata = metadata
    integration_cls = GcpIntegration
    features = frozenset([IntegrationFeatures.MONITORING])
    requires_feature_flag = True
    allow_multiple = False

    def get_pipeline_api_steps(self) -> ApiPipelineSteps[IntegrationPipeline]:
        return [GcpSaGenerationApiStep(), GcpCustomerConfigApiStep()]

    def build_integration(self, state: Mapping[str, Any]) -> IntegrationData:
        config = state.get("config", {})
        if not config:
            raise IntegrationConfigurationError("Missing configuration data")

        sentry_sa_email = state.get("sentry_sa_email")
        if not sentry_sa_email:
            raise IntegrationConfigurationError("Missing Sentry service account email")
        customer_sa_email: str = config["customer_sa_email"]
        projects: list[str] = config["projects"]

        for project_id in projects:
            validate_gcp_project_id(project_id)

        assert self.pipeline.organization is not None
        org_id = self.pipeline.organization.id

        return {
            "external_id": str(org_id),
            "name": "Google Cloud Platform",
            "metadata": {},
            "post_install_data": {
                "sentry_sa_email": sentry_sa_email,
                "customer_sa_email": customer_sa_email,
                "projects": projects,
            },
        }

    def post_install(
        self,
        integration: Integration,
        organization: RpcOrganization,
        *,
        extra: dict[str, Any],
    ) -> None:
        org_integration: OrganizationIntegration = OrganizationIntegration.objects.get(
            organization_id=organization.id,
            integration_id=integration.id,
        )
        gcp_config: GcpConfig = {
            "sentry_sa_email": extra["sentry_sa_email"],
            "customer_sa_email": extra["customer_sa_email"],
            "projects": extra["projects"],
        }
        org_integration.update(config=gcp_config)
