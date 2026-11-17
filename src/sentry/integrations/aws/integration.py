from __future__ import annotations

import logging
import uuid
from collections.abc import Mapping, MutableMapping
from typing import Any

from django.core.signing import BadSignature
from django.http.request import HttpRequest
from django.utils.translation import gettext_lazy as _
from rest_framework.exceptions import NotFound

from sentry import features
from sentry.integrations.aws.client import (
    AWS_MCP_REGIONS,
    AWS_NOT_CONFIGURED_MESSAGE,
    AWS_STATUS_CONNECTED,
    AWS_STATUS_UNVERIFIED,
    AwsVerifyConnectionResult,
    build_cloudformation_template,
    get_mcp_url,
    get_sentry_principal_arn,
    parse_role_arn,
)
from sentry.integrations.aws.serializers import (
    AwsRoleInput,
    AwsRoleSerializer,
    AwsVerificationInput,
    AwsVerificationInputSerializer,
)
from sentry.integrations.aws.verification import (
    VERIFICATION_MAX_AGE_SECONDS,
    verification_fields,
    verification_signer,
)
from sentry.integrations.base import (
    FeatureDescription,
    IntegrationData,
    IntegrationFeatures,
    IntegrationInstallation,
    IntegrationMetadata,
    IntegrationProvider,
)
from sentry.integrations.errors import OrganizationIntegrationNotFound
from sentry.integrations.models.integration import Integration
from sentry.integrations.models.organization_integration import OrganizationIntegration
from sentry.integrations.pipeline import IntegrationPipeline
from sentry.integrations.services.aws_seer import aws_seer_service
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


def get_cell_principal_arn(organization_id: int) -> str:
    """The Seer workload role in the organization's cell, which customer roles must trust."""
    principal_arn = aws_seer_service.get_principal_arn(organization_id=organization_id)
    if principal_arn is None:
        raise NotFound(AWS_NOT_CONFIGURED_MESSAGE)
    return principal_arn


class AwsRoleApiStep:
    step_name = "aws_role"

    def get_step_data(self, pipeline: IntegrationPipeline, request: HttpRequest) -> dict[str, Any]:
        assert pipeline.organization is not None
        organization = pipeline.organization
        principal_arn = get_cell_principal_arn(organization.id)
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
        if not pipeline.fetch_state("aws_external_id"):
            return PipelineStepResult.error("Restart setup to generate a Sentry external ID.")
        pipeline.bind_state("config", dict(validated_data))
        return PipelineStepResult.advance()


class AwsVerificationApiStep:
    step_name = "aws_verification"

    def get_step_data(self, pipeline: IntegrationPipeline, request: HttpRequest) -> dict[str, Any]:
        config: dict[str, Any] = pipeline.fetch_state("config") or {}
        return {
            "roleArn": config.get("role_arn", ""),
            "region": config.get("region", ""),
            "externalId": pipeline.fetch_state("aws_external_id") or "",
        }

    def get_serializer_cls(self) -> type:
        return AwsVerificationInputSerializer

    def handle_post(
        self,
        validated_data: AwsVerificationInput,
        pipeline: IntegrationPipeline,
        request: HttpRequest,
    ) -> PipelineStepResult:
        config: dict[str, Any] = pipeline.fetch_state("config") or {}
        assert pipeline.organization is not None
        external_id = pipeline.fetch_state("aws_external_id")
        if not external_id or not config:
            return PipelineStepResult.error("Restart setup to configure the AWS role.")
        signer = verification_signer(
            organization_id=pipeline.organization.id,
            role_arn=config["role_arn"],
            region=config["region"],
            external_id=external_id,
        )
        try:
            verification: AwsVerifyConnectionResult = signer.unsign_object(
                validated_data["verification_receipt"], max_age=VERIFICATION_MAX_AGE_SECONDS
            )
        except BadSignature:
            return PipelineStepResult.error("Please verify the configured AWS role again.")
        pipeline.bind_state("verification", verification)
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

    def get_config_data(self) -> Mapping[str, Any]:
        try:
            config = self.org_integration.config
        except OrganizationIntegrationNotFound:
            return {}
        if not config:
            return {}
        return {
            "role_arn": config.get("role_arn", ""),
            "region": config.get("region", ""),
            "external_id": config.get("external_id", ""),
            "connection_status": config.get("connection_status", AWS_STATUS_UNVERIFIED),
            "error_detail": config.get("error_detail"),
            "last_verified_at": config.get("last_verified_at"),
        }

    def update_organization_config(self, data: MutableMapping[str, Any]) -> None:
        config = self.org_integration.config
        external_id = config.get("external_id")
        if not external_id:
            raise IntegrationConfigurationError("AWS integration is not configured.")
        current = {key: config.get(key) for key in ("role_arn", "region")}
        serializer = AwsRoleSerializer(
            data={key: data.get(key, value) for key, value in current.items()}
        )
        serializer.is_valid(raise_exception=True)
        validated = serializer.validated_data
        if validated == current:
            return
        # Saving does not verify: the settings UI re-verifies through the cell-silo
        # verify-connection endpoint, which records the new status.
        org_integration = integration_service.update_organization_integration(
            org_integration_id=self.org_integration.id,
            config={
                **validated,
                "external_id": external_id,
                "connection_status": AWS_STATUS_UNVERIFIED,
                "error_detail": None,
                "last_verified_at": None,
            },
        )
        if org_integration is not None:
            self.org_integration = org_integration


class AwsIntegrationProvider(IntegrationProvider):
    key = IntegrationProviderSlug.AWS.value
    metadata = metadata
    integration_cls = AwsIntegration
    features = frozenset([IntegrationFeatures.SEER_CONTEXT])
    requires_feature_flag = True
    allow_multiple = False

    @property
    def name(self) -> str:
        return "AWS for Seer"

    def get_pipeline_api_steps(self) -> ApiPipelineSteps[IntegrationPipeline]:
        return [AwsRoleApiStep(), AwsVerificationApiStep()]

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
                },
                "verification": state.get("verification"),
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
        verification: AwsVerifyConnectionResult | None = extra.get("verification")
        if verification is None:
            logger.error(
                "aws.post_install_missing_verification",
                extra={"organization_id": organization.id, "integration_id": integration.id},
            )
        org_integration.update(config={**extra["config"], **verification_fields(verification)})


@org_monitoring_provider_registry.register(IntegrationProviderSlug.AWS.value)
class AwsOrgMonitoringProvider(OrgMonitoringProvider):
    provider_key = IntegrationProviderSlug.AWS.value

    def is_verified(self, organization: Organization) -> bool:
        org_integration = integration_service.organization_context(
            organization_id=organization.id, provider=self.provider_key
        ).organization_integration
        if org_integration is None:
            return False
        return org_integration.config.get("connection_status") == AWS_STATUS_CONNECTED

    def build_connection(
        self, organization: Organization
    ) -> list[AwsAssumeRoleConnectionData] | None:
        if not features.has("organizations:integrations-aws", organization):
            return None
        active = integration_service.organization_context(
            organization_id=organization.id, provider=self.provider_key
        ).active()
        if active is None:
            return None
        integration, org_integration = active
        config = org_integration.config
        if config.get("connection_status") != AWS_STATUS_CONNECTED:
            return None
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
