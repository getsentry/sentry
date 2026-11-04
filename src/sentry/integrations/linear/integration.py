from __future__ import annotations

import logging
from collections.abc import Mapping, MutableMapping
from typing import Any, TypedDict

from django.http.request import HttpRequest
from django.utils.translation import gettext_lazy as _
from rest_framework.fields import CharField

from sentry.api.serializers.rest_framework.base import CamelSnakeSerializer
from sentry.constants import ObjectStatus
from sentry.integrations.base import (
    FeatureDescription,
    IntegrationData,
    IntegrationFeatures,
    IntegrationInstallation,
    IntegrationMetadata,
    IntegrationProvider,
)
from sentry.integrations.linear.client import (
    LINEAR_MCP_URL,
    LinearWorkspace,
    validate_linear_api_key,
)
from sentry.integrations.pipeline import IntegrationPipeline
from sentry.integrations.services.integration import integration_service
from sentry.integrations.types import IntegrationProviderSlug
from sentry.models.organization import Organization
from sentry.pipeline.types import PipelineStepResult
from sentry.pipeline.views.base import ApiPipelineSteps
from sentry.seer.agent.monitoring_providers import (
    OrgMonitoringProvider,
    org_monitoring_provider_registry,
)
from sentry.seer.sentry_data_models import HeaderAuthConnectionData
from sentry.seer.utils import encrypt_access_token_for_seer
from sentry.shared_integrations.exceptions import IntegrationConfigurationError

logger = logging.getLogger(__name__)

DESCRIPTION = """
Connect your Linear workspace so Seer can read issues, projects, and comments while
investigating issues — shared across everyone in your organization.
"""

FEATURES = [
    FeatureDescription(
        "Give Seer read-only access to your Linear issues, projects, and comments while investigating issues.",
        IntegrationFeatures.SEER_CONTEXT,
    ),
]

metadata = IntegrationMetadata(
    description=DESCRIPTION.strip(),
    features=FEATURES,
    author="The Sentry Team",
    noun=_("Workspace"),
    issue_url="https://github.com/getsentry/sentry/issues/new?assignees=&labels=Component:%20Integrations&template=bug.yml&title=Linear%20Integration%20Problem",
    source_url="https://github.com/getsentry/sentry/tree/master/src/sentry/integrations/linear",
    aspects={},
)


def _integration_name(workspace: LinearWorkspace) -> str:
    return f"Linear ({workspace['name']})"


class LinearCredentials(TypedDict):
    api_key: str


class LinearCredentialsSerializer(CamelSnakeSerializer[LinearCredentials]):
    api_key = CharField(required=True, max_length=255)


class LinearCredentialsApiStep:
    step_name = "linear_credentials"

    def get_step_data(self, pipeline: IntegrationPipeline, request: HttpRequest) -> dict[str, Any]:
        return {}

    def get_serializer_cls(self) -> type:
        return LinearCredentialsSerializer

    def handle_post(
        self,
        validated_data: LinearCredentials,
        pipeline: IntegrationPipeline,
        request: HttpRequest,
    ) -> PipelineStepResult:
        # Validate before advancing so connection errors leave this step available for retries.
        try:
            workspace = validate_linear_api_key(validated_data["api_key"])
        except IntegrationConfigurationError as e:
            return PipelineStepResult.error(str(e))

        pipeline.bind_state(
            "config", {"api_key": validated_data["api_key"], "workspace": dict(workspace)}
        )
        return PipelineStepResult.advance()


class LinearIntegration(IntegrationInstallation):
    def get_client(self) -> Any:
        raise NotImplementedError

    def get_organization_config(self) -> list[dict[str, Any]]:
        return [
            {
                "name": "api_key",
                "type": "secret",
                "label": _("API Key"),
                "help": _("Leave blank to keep the current key."),
                "required": False,
                "formatMessageValue": False,
            },
        ]

    def update_organization_config(self, data: MutableMapping[str, Any]) -> None:
        """Save a new API key, or re-test the stored one when none is given.

        Raises if the connection check fails, even when nothing changed.
        """
        stored_api_key = (self.model.metadata or {}).get("api_key")
        api_key = (data.get("api_key") or "").strip() or stored_api_key
        if not api_key:
            raise IntegrationConfigurationError("Linear integration is not configured.")

        workspace = validate_linear_api_key(api_key)

        name = _integration_name(workspace)
        integration_service.update_integration(
            integration_id=self.model.id, name=name, metadata={"api_key": api_key}
        )
        self.model.name = name
        self.model.metadata = {"api_key": api_key}


class LinearIntegrationProvider(IntegrationProvider):
    key = IntegrationProviderSlug.LINEAR.value
    name = "Linear for Seer"
    metadata = metadata
    integration_cls = LinearIntegration
    features = frozenset([IntegrationFeatures.SEER_CONTEXT])
    requires_feature_flag = True
    allow_multiple = False

    def get_pipeline_api_steps(self) -> ApiPipelineSteps[IntegrationPipeline]:
        return [LinearCredentialsApiStep()]

    def build_integration(self, state: Mapping[str, Any]) -> IntegrationData:
        config = state.get("config", {})
        if not config:
            raise IntegrationConfigurationError("Missing configuration data")

        assert self.pipeline.organization is not None
        return {
            # One installation per Sentry organization. Keying on the Linear workspace would let
            # two Sentry organizations connected to one workspace share, and overwrite, a key.
            "external_id": str(self.pipeline.organization.id),
            "name": _integration_name(config["workspace"]),
            "metadata": {"api_key": config["api_key"]},
        }


@org_monitoring_provider_registry.register(IntegrationProviderSlug.LINEAR.value)
class LinearOrgMonitoringProvider(OrgMonitoringProvider):
    """Surfaces the org-level Linear integration to Seer as a shared, read-only MCP connection."""

    provider_key = IntegrationProviderSlug.LINEAR.value

    def build_connection(self, organization: Organization) -> list[HeaderAuthConnectionData] | None:
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

        api_key = (integration.metadata or {}).get("api_key")
        if not api_key:
            logger.error(
                "seer.monitoring_providers.linear_integration_invalid",
                extra={
                    "organization_id": organization.id,
                    "integration_id": integration.id,
                },
            )
            return None

        # Linear's MCP server takes API keys as bearer tokens, unlike its GraphQL API.
        encrypted_auth_header = encrypt_access_token_for_seer(f"Bearer {api_key}")
        if not encrypted_auth_header:
            return None

        return [
            HeaderAuthConnectionData(
                provider_key=self.provider_key,
                url=LINEAR_MCP_URL,
                encrypted_auth_headers={"Authorization": encrypted_auth_header},
                identity_id=None,
                auth_method="api_key",
                refreshable=False,
            )
        ]
