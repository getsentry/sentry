from __future__ import annotations

import logging
import uuid
from collections.abc import Mapping, MutableMapping
from typing import Any, TypedDict

from django.http.request import HttpRequest
from django.utils.translation import gettext_lazy as _
from rest_framework.fields import CharField, ChoiceField
from rest_framework.serializers import ValidationError

from sentry import features
from sentry.api.serializers.rest_framework.base import CamelSnakeSerializer
from sentry.constants import ObjectStatus
from sentry.integrations.aws.client import (
    AWS_MCP_REGIONS,
    build_cloudformation_template,
    get_mcp_url,
    get_sentry_principal_arn,
    parse_role_arn,
    validate_aws_connection,
)
from sentry.integrations.base import (
    FeatureDescription,
    IntegrationData,
    IntegrationFeatures,
    IntegrationInstallation,
    IntegrationMetadata,
    IntegrationProvider,
)
from sentry.integrations.models.integration import Integration
from sentry.integrations.models.organization_integration import OrganizationIntegration
from sentry.integrations.pipeline import IntegrationPipeline
from sentry.integrations.services.integration import integration_service
from sentry.integrations.types import IntegrationProviderSlug
from sentry.locks import locks
from sentry.models.organization import Organization
from sentry.organizations.services.organization import RpcOrganization
from sentry.pipeline.types import PipelineStepResult
from sentry.pipeline.views.base import ApiPipelineSteps
from sentry.seer.agent.monitoring_providers import (
    OrgMonitoringProvider,
    org_monitoring_provider_registry,
)
from sentry.seer.sentry_data_models import AwsAssumeRoleConnectionData
from sentry.shared_integrations.exceptions import IntegrationConfigurationError

logger = logging.getLogger(__name__)

metadata = IntegrationMetadata(
    description=(
        "Connect your AWS account so Seer can query infrastructure metrics, logs, and traces "
        "while investigating issues. Access is shared across your Sentry organization."
    ),
    features=[
        FeatureDescription(
            "Give Seer access to AWS telemetry using an IAM role and temporary credentials.",
            IntegrationFeatures.SEER_CONTEXT,
        )
    ],
    author="The Sentry Team",
    noun=_("Account"),
    issue_url="https://github.com/getsentry/sentry/issues/new?labels=Component:%20Integrations&template=bug.yml&title=AWS%20for%20Seer%20Problem",
    source_url="https://github.com/getsentry/sentry/tree/master/src/sentry/integrations/aws",
    aspects={},
)


class AwsRoleInput(TypedDict):
    role_arn: str
    region: str


class AwsRoleSerializer(CamelSnakeSerializer[AwsRoleInput]):
    role_arn = CharField(required=True, max_length=2048)
    region = ChoiceField(choices=[(region, region) for region in AWS_MCP_REGIONS], required=True)

    def validate_role_arn(self, value: str) -> str:
        try:
            return parse_role_arn(value)
        except IntegrationConfigurationError as error:
            raise ValidationError(str(error)) from error


class AwsRoleApiStep:
    step_name = "aws_role"

    def get_step_data(self, pipeline: IntegrationPipeline, request: HttpRequest) -> dict[str, Any]:
        principal_arn = get_sentry_principal_arn()
        assert pipeline.organization is not None
        organization = pipeline.organization
        # Setup state expires. Persist the trust identifier before returning a template,
        # and serialize first-time setup across users and concurrent pipelines.
        with locks.get(
            f"aws-seer:external-id:{organization.id}", duration=30, name="aws_seer_external_id"
        ).blocking_acquire(initial_delay=0.1, timeout=10):
            external_id = organization.get_option("aws-seer.external-id")
            if not external_id:
                existing = integration_service.organization_context(
                    organization_id=organization.id, provider="aws"
                ).organization_integration
                external_id = (existing.config.get("external_id") if existing else None) or str(
                    uuid.uuid4()
                )
                organization.update_option("aws-seer.external-id", external_id)
        pipeline.bind_state("aws_external_id", external_id)
        return {
            "externalId": external_id,
            "principalArn": principal_arn,
            "regions": list(AWS_MCP_REGIONS),
            "cloudFormationTemplate": build_cloudformation_template(principal_arn, external_id),
        }

    def get_serializer_cls(self) -> type:
        return AwsRoleSerializer

    def handle_post(
        self,
        validated_data: AwsRoleInput,
        pipeline: IntegrationPipeline,
        request: HttpRequest,
    ) -> PipelineStepResult:
        external_id = pipeline.fetch_state("aws_external_id")
        if not external_id:
            return PipelineStepResult.error("Restart setup to generate a Sentry external ID.")
        try:
            validate_aws_connection(
                validated_data["role_arn"], external_id, validated_data["region"]
            )
        except IntegrationConfigurationError as error:
            return PipelineStepResult.error(str(error))
        pipeline.bind_state("config", dict(validated_data))
        return PipelineStepResult.advance()


class AwsIntegration(IntegrationInstallation):
    def get_client(self) -> Any:
        raise NotImplementedError

    def get_organization_config(self) -> list[dict[str, Any]]:
        return [
            {
                "name": "role_arn",
                "type": "string",
                "label": _("IAM Role ARN"),
                "help": _("The AWS role Seer assumes to read your infrastructure telemetry."),
                "required": True,
            },
            {
                "name": "region",
                "type": "select",
                "label": _("AWS MCP Region"),
                "help": _("The region hosting the AWS MCP server. It can query other AWS regions."),
                "choices": [(region, region) for region in AWS_MCP_REGIONS],
                "required": True,
            },
            {
                "name": "external_id",
                "type": "string",
                "label": _("External ID"),
                "help": _(
                    "Your role's trust policy must require this Sentry-generated external ID."
                ),
                "disabled": True,
                "disabledReason": _("Managed by Sentry"),
            },
        ]

    def update_organization_config(self, data: MutableMapping[str, Any]) -> None:
        config = self.org_integration.config
        external_id = config.get("external_id")
        if not external_id:
            raise IntegrationConfigurationError("AWS integration is not configured.")
        serializer = AwsRoleSerializer(
            data={
                "role_arn": data.get("role_arn", config.get("role_arn")),
                "region": data.get("region", config.get("region")),
            }
        )
        serializer.is_valid(raise_exception=True)
        validated = serializer.validated_data
        validate_aws_connection(validated["role_arn"], external_id, validated["region"])
        org_integration = integration_service.update_organization_integration(
            org_integration_id=self.org_integration.id,
            config={**validated, "external_id": external_id},
        )
        if org_integration is not None:
            self.org_integration = org_integration


class AwsIntegrationProvider(IntegrationProvider):
    key = IntegrationProviderSlug.AWS.value
    name = "AWS for Seer"
    metadata = metadata
    integration_cls = AwsIntegration
    features = frozenset([IntegrationFeatures.SEER_CONTEXT])
    requires_feature_flag = True
    allow_multiple = False

    def get_pipeline_api_steps(self) -> ApiPipelineSteps[IntegrationPipeline]:
        return [AwsRoleApiStep()]

    def build_integration(self, state: Mapping[str, Any]) -> IntegrationData:
        config = state.get("config")
        external_id = state.get("aws_external_id")
        if not config or not external_id:
            raise IntegrationConfigurationError("Missing AWS role configuration.")
        role_arn = parse_role_arn(config["role_arn"])
        get_mcp_url(config["region"])
        assert self.pipeline.organization is not None
        return {
            "external_id": str(self.pipeline.organization.id),
            "name": self.name,
            "metadata": {},
            "post_install_data": {
                "config": {
                    "role_arn": role_arn,
                    "region": config["region"],
                    "external_id": external_id,
                }
            },
        }

    def post_install(
        self,
        integration: Integration,
        organization: RpcOrganization,
        *,
        extra: dict[str, Any],
    ) -> None:
        org_integration = OrganizationIntegration.objects.get(
            organization_id=organization.id, integration_id=integration.id
        )
        org_integration.update(config=extra["config"])


@org_monitoring_provider_registry.register(IntegrationProviderSlug.AWS.value)
class AwsOrgMonitoringProvider(OrgMonitoringProvider):
    provider_key = IntegrationProviderSlug.AWS.value

    def build_connection(
        self, organization: Organization
    ) -> list[AwsAssumeRoleConnectionData] | None:
        if not features.has("organizations:integrations-aws", organization):
            return None
        ctx = integration_service.organization_context(
            organization_id=organization.id, provider=self.provider_key
        )
        integration = ctx.integration
        org_integration = ctx.organization_integration
        if (
            integration is None
            or org_integration is None
            or integration.status != ObjectStatus.ACTIVE
            or org_integration.status != ObjectStatus.ACTIVE
        ):
            return None
        config = org_integration.config
        role_arn = config.get("role_arn")
        external_id = config.get("external_id")
        region = config.get("region")
        if not role_arn or not external_id or region not in AWS_MCP_REGIONS:
            logger.error(
                "seer.monitoring_providers.aws_integration_invalid",
                extra={"organization_id": organization.id, "integration_id": integration.id},
            )
            return None
        try:
            principal_arn = get_sentry_principal_arn()
            role_arn = parse_role_arn(role_arn)
        except IntegrationConfigurationError:
            logger.exception(
                "seer.monitoring_providers.aws_identity_invalid",
                extra={"organization_id": organization.id, "integration_id": integration.id},
            )
            return None
        return [
            AwsAssumeRoleConnectionData(
                provider_key=self.provider_key,
                url=get_mcp_url(region),
                role_arn=role_arn,
                external_id=external_id,
                region=region,
                principal_arn=principal_arn,
            )
        ]
