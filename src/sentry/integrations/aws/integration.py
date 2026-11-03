from __future__ import annotations

import secrets
from collections.abc import Mapping, MutableMapping
from typing import Any, TypedDict

import orjson
from django.http.request import HttpRequest
from django.utils import timezone
from django.utils.translation import gettext_lazy as _
from pydantic import ValidationError as PydanticValidationError
from rest_framework.fields import CharField, ChoiceField, ListField
from rest_framework.serializers import ValidationError

from sentry import features, options
from sentry.api.serializers.rest_framework.base import (
    CamelSnakeSerializer,
    convert_dict_key_case,
    snake_to_camel_case,
)
from sentry.constants import ObjectStatus
from sentry.integrations.aws.client import AwsVerification, verify_aws_connection
from sentry.integrations.aws.setup import PERMISSION_POLICY, terraform_config, trust_policy
from sentry.integrations.aws.utils import (
    AWS_MCP_URL,
    AWS_REGIONS,
    AWS_STACK_URL,
    cloudformation_url,
    parse_regions,
    parse_role_arn,
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
from sentry.integrations.services.integration import integration_service
from sentry.integrations.types import IntegrationProviderSlug
from sentry.models.organization import Organization
from sentry.organizations.services.organization import RpcOrganization
from sentry.pipeline.types import PipelineStepResult
from sentry.pipeline.views.base import ApiPipelineSteps
from sentry.seer.agent.monitoring_providers import (
    OrgMonitoringProvider,
    org_monitoring_provider_registry,
)
from sentry.seer.sentry_data_models import AwsAssumeRoleConnectionData
from sentry.shared_integrations.exceptions import IntegrationConfigurationError, IntegrationError


class AwsConfigInput(TypedDict):
    role_arn: str
    regions: list[str]


class AwsConfigInputSerializer(CamelSnakeSerializer[AwsConfigInput]):
    role_arn = CharField(max_length=2048)
    regions = ListField(child=CharField(max_length=32), min_length=1, max_length=len(AWS_REGIONS))

    def validate_role_arn(self, value: str) -> str:
        try:
            return parse_role_arn(value)
        except IntegrationConfigurationError as exc:
            raise ValidationError(str(exc)) from exc

    def validate_regions(self, value: list[str]) -> list[str]:
        try:
            return parse_regions(value)
        except IntegrationConfigurationError as exc:
            raise ValidationError(str(exc)) from exc


class AwsSetupApiStep:
    step_name = "aws_setup"

    def get_step_data(self, pipeline: IntegrationPipeline, request: HttpRequest) -> dict[str, Any]:
        principal_arn = options.get("seer-aws.principal-arn")
        template_url = options.get("seer-aws.cloudformation-url")
        if not principal_arn or not isinstance(template_url, str) or not template_url:
            raise IntegrationConfigurationError("AWS for Seer setup is not available yet.")
        principal_arn = parse_role_arn(principal_arn)
        external_id = pipeline.fetch_state("external_id")
        if not external_id:
            external_id = secrets.token_hex(32)
            pipeline.bind_state("external_id", external_id)
        return {
            "externalId": external_id,
            "sentryPrincipalArn": principal_arn,
            "cloudformationUrl": cloudformation_url(template_url, principal_arn, external_id),
            "trustPolicy": orjson.dumps(
                trust_policy(principal_arn, external_id), option=orjson.OPT_INDENT_2
            ).decode(),
            "permissionPolicy": orjson.dumps(
                PERMISSION_POLICY, option=orjson.OPT_INDENT_2
            ).decode(),
            "terraform": terraform_config(principal_arn, external_id),
        }

    def get_serializer_cls(self) -> type | None:
        return None

    def handle_post(
        self, validated_data: Any, pipeline: IntegrationPipeline, request: HttpRequest
    ) -> PipelineStepResult:
        if not pipeline.fetch_state("external_id"):
            return PipelineStepResult.error("Start AWS setup to generate an external ID.")
        return PipelineStepResult.advance()


class AwsCustomerConfigApiStep:
    step_name = "aws_customer_config"

    def get_step_data(self, pipeline: IntegrationPipeline, request: HttpRequest) -> dict[str, Any]:
        return {"regions": AWS_REGIONS}

    def get_serializer_cls(self) -> type:
        return AwsConfigInputSerializer

    def handle_post(
        self, validated_data: AwsConfigInput, pipeline: IntegrationPipeline, request: HttpRequest
    ) -> PipelineStepResult:
        pipeline.bind_state("config", dict(validated_data))
        pipeline.bind_state("verification", None)
        return PipelineStepResult.advance()


class AwsVerificationInput(TypedDict):
    action: str


class AwsVerificationInputSerializer(CamelSnakeSerializer[AwsVerificationInput]):
    action = ChoiceField(choices=("verify", "finish"))


class AwsVerificationApiStep:
    step_name = "aws_verification"

    def get_step_data(self, pipeline: IntegrationPipeline, request: HttpRequest) -> dict[str, Any]:
        result = pipeline.fetch_state("verification")
        return {
            "verification": convert_dict_key_case(result, snake_to_camel_case) if result else None
        }

    def get_serializer_cls(self) -> type:
        return AwsVerificationInputSerializer

    def handle_post(
        self,
        validated_data: AwsVerificationInput,
        pipeline: IntegrationPipeline,
        request: HttpRequest,
    ) -> PipelineStepResult:
        if validated_data["action"] == "finish":
            verification = pipeline.fetch_state("verification")
            if not verification or not AwsVerification.parse_obj(verification).can_connect:
                return PipelineStepResult.error(
                    "Verify the role's external ID requirement and access to at least one region."
                )
            return PipelineStepResult.advance()

        assert pipeline.organization is not None
        config = pipeline.fetch_state("config")
        external_id = pipeline.fetch_state("external_id")
        if not config or not external_id:
            return PipelineStepResult.error("Complete AWS setup before verifying the connection.")
        # Never accept verification results or an external ID from the browser.
        pipeline.bind_state("verification", None)
        try:
            result = verify_aws_connection(
                organization_id=pipeline.organization.id,
                role_arn=config["role_arn"],
                external_id=external_id,
                regions=config["regions"],
            )
        except IntegrationError as exc:
            return PipelineStepResult.error(str(exc))
        pipeline.bind_state("verification", result.dict())
        return PipelineStepResult.stay(self.get_step_data(pipeline, request))


class AwsIntegration(IntegrationInstallation):
    def get_client(self) -> Any:
        raise NotImplementedError

    def get_organization_config(self) -> list[dict[str, Any]]:
        return [
            {
                "name": "sentry_principal_arn",
                "type": "string",
                "label": _("Sentry Principal ARN"),
                "disabled": True,
                "disabledReason": _("Managed by Sentry"),
            },
            {
                "name": "external_id",
                "type": "string",
                "label": _("External ID"),
                "help": _("Your role's trust policy must require this external ID."),
                "disabled": True,
                "disabledReason": _("Managed by Sentry"),
            },
            {
                "name": "role_arn",
                "type": "string",
                "label": _("IAM Role ARN"),
                "help": _("The read-only telemetry role in your AWS account."),
                "required": True,
            },
            {
                "name": "regions",
                "type": "select",
                "label": _("AWS Regions"),
                "choices": [(region, region) for region in AWS_REGIONS],
                "multiple": True,
                "required": True,
            },
        ]

    def get_config_data(self) -> Mapping[str, Any]:
        try:
            config = self.org_integration.config
        except OrganizationIntegrationNotFound:
            return {}
        if not config:
            return {}
        return {**config, "sentry_principal_arn": options.get("seer-aws.principal-arn")}

    def get_dynamic_display_information(self) -> Mapping[str, Any]:
        return {
            "configure_integration": {
                "instructions": [
                    f"To remove AWS access, delete the SentrySeerAccess stack in [CloudFormation]({AWS_STACK_URL}). Existing sessions can last up to one hour after uninstalling in Sentry."
                ]
            }
        }

    def update_organization_config(self, data: MutableMapping[str, Any]) -> None:
        config = self.org_integration.config
        if not config.get("external_id") or not config.get("role_arn"):
            raise IntegrationConfigurationError("AWS integration is not configured.")
        role_arn = parse_role_arn(data.get("role_arn", config["role_arn"]))
        regions = parse_regions(data.get("regions", config["regions"]))
        if role_arn.split(":")[4] != config["aws_account_id"]:
            raise IntegrationConfigurationError(
                "Install another integration to connect a different AWS account."
            )

        # An empty update re-tests the stored configuration. Ignore all client-supplied
        # external IDs, account IDs and verification results, including read-only form fields.
        result = verify_aws_connection(
            organization_id=self.organization_id,
            role_arn=role_arn,
            external_id=config["external_id"],
            regions=regions,
        )
        integration_service.update_organization_integration(
            org_integration_id=self.org_integration.id,
            config={
                **config,
                "role_arn": role_arn,
                "regions": regions,
                "verification": result.dict(),
                "last_verified_at": timezone.now().isoformat(),
            },
        )


class AwsIntegrationProvider(IntegrationProvider):
    key = IntegrationProviderSlug.AWS.value
    name = "AWS for Seer"
    integration_cls = AwsIntegration
    features = frozenset([IntegrationFeatures.SEER_CONTEXT])
    requires_feature_flag = True
    allow_multiple = True
    metadata = IntegrationMetadata(
        description="Connect your AWS accounts so Seer can read CloudWatch metrics, logs, and X-Ray traces while investigating issues.",
        features=[
            FeatureDescription(
                "Give Seer read-only access to AWS telemetry for everyone in your organization.",
                IntegrationFeatures.SEER_CONTEXT,
            )
        ],
        author="The Sentry Team",
        noun=_("Account"),
        issue_url="https://github.com/getsentry/sentry/issues/new?labels=Component:%20Integrations&template=bug.yml&title=AWS%20for%20Seer%20Problem",
        source_url="https://github.com/getsentry/sentry/tree/master/src/sentry/integrations/aws",
        aspects={},
    )

    def get_pipeline_api_steps(self) -> ApiPipelineSteps[IntegrationPipeline]:
        return [AwsSetupApiStep(), AwsCustomerConfigApiStep(), AwsVerificationApiStep()]

    def build_integration(self, state: Mapping[str, Any]) -> IntegrationData:
        config = state.get("config")
        external_id = state.get("external_id")
        if not config or not external_id:
            raise IntegrationConfigurationError("Complete AWS setup before installing.")
        role_arn = parse_role_arn(config.get("role_arn"))
        regions = parse_regions(config.get("regions"))
        try:
            verification = AwsVerification.parse_obj(state.get("verification"))
        except PydanticValidationError as exc:
            raise IntegrationConfigurationError(
                "Verify the AWS connection before installing."
            ) from exc
        if not verification.can_connect or {r.region for r in verification.regions} != set(regions):
            raise IntegrationConfigurationError("Verify the AWS connection before installing.")

        assert self.pipeline.organization is not None
        org_id = self.pipeline.organization.id
        account_id = role_arn.split(":")[4]
        # Integration.external_id is a database identity, not the STS external ID.
        # Scope it to the Sentry org so the same AWS account can connect to two orgs
        # without sharing either one's trust grant.
        integration_external_id = f"{org_id}:{account_id}"
        existing = integration_service.get_integration(
            organization_id=org_id, provider=self.key, external_id=integration_external_id
        )
        if existing is not None:
            raise IntegrationConfigurationError(
                "This AWS account is already installed. Edit its integration settings."
            )
        return {
            "external_id": integration_external_id,
            "name": f"AWS ({account_id})",
            "metadata": {},
            "post_install_data": {
                "role_arn": role_arn,
                "aws_account_id": account_id,
                "external_id": external_id,
                "regions": regions,
                "verification": verification.dict(),
                "last_verified_at": timezone.now().isoformat(),
            },
        }

    def post_install(
        self, integration: Integration, organization: RpcOrganization, *, extra: dict[str, Any]
    ) -> None:
        org_integration = OrganizationIntegration.objects.get(
            organization_id=organization.id, integration_id=integration.id
        )
        org_integration.update(config=extra)


@org_monitoring_provider_registry.register(IntegrationProviderSlug.AWS.value)
class AwsOrgMonitoringProvider(OrgMonitoringProvider):
    provider_key = IntegrationProviderSlug.AWS.value

    def is_verified(self, organization: Organization) -> bool:
        return bool(self.build_connection(organization))

    def build_connection(
        self, organization: Organization
    ) -> list[AwsAssumeRoleConnectionData] | None:
        if not features.has("organizations:integrations-aws", organization):
            return None
        integrations = integration_service.get_integrations(
            organization_id=organization.id,
            providers=[self.provider_key],
            status=ObjectStatus.ACTIVE,
            org_integration_status=ObjectStatus.ACTIVE,
        )
        if not integrations:
            return None
        active_ids = {integration.id for integration in integrations}
        org_integrations = integration_service.get_organization_integrations(
            organization_id=organization.id,
            providers=[self.provider_key],
            status=ObjectStatus.ACTIVE,
        )
        connections = []
        for org_integration in org_integrations:
            if org_integration.integration_id not in active_ids:
                continue
            config = org_integration.config
            if not config.get("role_arn") or not config.get("external_id"):
                continue
            try:
                verification = AwsVerification.parse_obj(config.get("verification"))
                role_arn = parse_role_arn(config["role_arn"])
                regions = parse_regions(config.get("regions"))
            except (PydanticValidationError, IntegrationConfigurationError):
                continue
            if not verification.can_connect:
                continue
            connected_regions = {
                r.region for r in verification.regions if r.connection_status == "connected"
            }
            regions = [region for region in regions if region in connected_regions]
            if not regions:
                continue
            connections.append(
                AwsAssumeRoleConnectionData(
                    provider_key=self.provider_key,
                    url=AWS_MCP_URL,
                    role_arn=role_arn,
                    external_id=config["external_id"],
                    regions=regions,
                )
            )
        return connections or None
