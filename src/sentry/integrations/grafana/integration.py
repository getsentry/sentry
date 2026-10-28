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
from sentry.integrations.grafana.client import (
    normalize_grafana_url,
    validate_grafana_connection,
)
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
from sentry.seer.sentry_data_models import HeaderAuthConnectionData
from sentry.seer.utils import encrypt_access_token_for_seer
from sentry.shared_integrations.exceptions import IntegrationConfigurationError

logger = logging.getLogger(__name__)

DESCRIPTION = """
Connect your Grafana Cloud stack so Seer can query your metrics and logs while
investigating issues — shared across everyone in your organization.
"""

FEATURES = [
    FeatureDescription(
        "Give Seer access to your Grafana data sources (metrics, logs) while investigating issues.",
        IntegrationFeatures.SEER_CONTEXT,
    ),
]

metadata = IntegrationMetadata(
    description=DESCRIPTION.strip(),
    features=FEATURES,
    author="The Sentry Team",
    noun=_("Stack"),
    issue_url="https://github.com/getsentry/sentry/issues/new?assignees=&labels=Component:%20Integrations&template=bug.yml&title=Grafana%20Integration%20Problem",
    source_url="https://github.com/getsentry/sentry/tree/master/src/sentry/integrations/grafana",
    aspects={},
)


class GrafanaCredentials(TypedDict):
    url: str
    token: str


class GrafanaCredentialsSerializer(CamelSnakeSerializer[GrafanaCredentials]):
    url = CharField(required=True, max_length=255)
    token = CharField(required=True, max_length=255)


class GrafanaCredentialsApiStep:
    step_name = "grafana_credentials"

    def get_step_data(self, pipeline: IntegrationPipeline, request: HttpRequest) -> dict[str, Any]:
        return {}

    def get_serializer_cls(self) -> type:
        return GrafanaCredentialsSerializer

    def handle_post(
        self,
        validated_data: GrafanaCredentials,
        pipeline: IntegrationPipeline,
        request: HttpRequest,
    ) -> PipelineStepResult:
        # Validate before advancing so connection errors leave this step available for retries.
        try:
            url = normalize_grafana_url(validated_data["url"])
            validate_grafana_connection(url, validated_data["token"])
        except IntegrationConfigurationError as e:
            return PipelineStepResult.error(str(e))

        pipeline.bind_state("config", {**validated_data, "url": url})
        return PipelineStepResult.advance()


class GrafanaIntegration(IntegrationInstallation):
    def get_client(self) -> Any:
        raise NotImplementedError

    def get_organization_config(self) -> list[dict[str, Any]]:
        return [
            {
                "name": "url",
                "type": "string",
                "label": _("Grafana URL"),
                "help": _("Your Grafana Cloud stack URL, like https://your-stack.grafana.net."),
                "required": True,
            },
            {
                "name": "token",
                "type": "secret",
                "label": _("Service Account Token"),
                "help": _("Leave blank to keep the current token."),
                "required": False,
                "formatMessageValue": False,
            },
        ]

    def update_organization_config(self, data: MutableMapping[str, Any]) -> None:
        """Save URL/token edits, or re-test the connection when nothing changed.

        Raises if the connection check fails, even when nothing changed.
        """
        config = self.org_integration.config
        stored_token = (self.model.metadata or {}).get("token")
        if not config.get("url") or not stored_token:
            raise IntegrationConfigurationError("Grafana integration is not configured.")

        url = normalize_grafana_url(data["url"]) if data.get("url") else config["url"]
        token = data.get("token") or stored_token
        validate_grafana_connection(url, token)

        name = f"Grafana ({url.removeprefix('https://')})"
        integration_service.update_integration(
            integration_id=self.model.id, name=name, metadata={"token": token}
        )
        self.model.name = name
        self.model.metadata = {"token": token}
        integration_service.update_organization_integration(
            org_integration_id=self.org_integration.id, config={"url": url}
        )


class GrafanaIntegrationProvider(IntegrationProvider):
    key = IntegrationProviderSlug.GRAFANA.value
    name = "Grafana for Seer"
    metadata = metadata
    integration_cls = GrafanaIntegration
    features = frozenset([IntegrationFeatures.SEER_CONTEXT])
    requires_feature_flag = True
    allow_multiple = False

    def get_pipeline_api_steps(self) -> ApiPipelineSteps[IntegrationPipeline]:
        return [GrafanaCredentialsApiStep()]

    def build_integration(self, state: Mapping[str, Any]) -> IntegrationData:
        config = state.get("config", {})
        if not config:
            raise IntegrationConfigurationError("Missing configuration data")

        url = normalize_grafana_url(config["url"])
        token: str = config["token"]

        assert self.pipeline.organization is not None
        return {
            "external_id": str(self.pipeline.organization.id),
            "name": f"Grafana ({url.removeprefix('https://')})",
            "metadata": {"token": token},
            "post_install_data": {
                "config": {"url": url},
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
            organization_id=organization.id,
            integration_id=integration.id,
        )
        org_integration.update(config=extra["config"])


@org_monitoring_provider_registry.register(IntegrationProviderSlug.GRAFANA.value)
class GrafanaOrgMonitoringProvider(OrgMonitoringProvider):
    """Surfaces the org-level Grafana integration to Seer as a shared monitoring connection."""

    provider_key = IntegrationProviderSlug.GRAFANA.value

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

        token = (integration.metadata or {}).get("token")
        grafana_url = (org_integration.config or {}).get("url")
        if not (token and grafana_url):
            logger.error(
                "seer.monitoring_providers.grafana_integration_invalid",
                extra={
                    "organization_id": organization.id,
                    "integration_id": integration.id,
                },
            )
            return None

        encrypted_auth_header = encrypt_access_token_for_seer(f"Bearer {token}")
        if not encrypted_auth_header:
            return None

        return [
            HeaderAuthConnectionData(
                provider_key=self.provider_key,
                url=grafana_url,
                encrypted_auth_headers={"Authorization": encrypted_auth_header},
                identity_id=None,
                auth_method="service_account_token",
                refreshable=False,
            )
        ]
