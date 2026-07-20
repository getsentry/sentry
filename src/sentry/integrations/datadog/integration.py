from __future__ import annotations

import hashlib
import logging
from collections.abc import Mapping, MutableMapping
from typing import Any, TypedDict, cast

from django.http.request import HttpRequest
from django.utils.translation import gettext_lazy as _
from rest_framework.fields import CharField

from sentry.api.serializers.rest_framework.base import CamelSnakeSerializer
from sentry.constants import ObjectStatus
from sentry.identity.datadog.provider import (
    DATADOG_VALID_SITES,
    MCP_ENDPOINT_PATH,
    mcp_base_url_for_site,
)
from sentry.integrations.base import (
    FeatureDescription,
    IntegrationData,
    IntegrationFeatures,
    IntegrationInstallation,
    IntegrationMetadata,
    IntegrationProvider,
)
from sentry.integrations.datadog.client import validate_datadog_credentials
from sentry.integrations.models.integration import Integration
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
from sentry.seer.sentry_data_models import MonitoringProviderConnectionData
from sentry.seer.utils import encrypt_access_token_for_seer
from sentry.shared_integrations.exceptions import IntegrationConfigurationError

logger = logging.getLogger(__name__)

DESCRIPTION = """
Connect your Datadog organization so Seer can pull in infrastructure telemetry
while investigating issues — shared across everyone in your organization.
"""

FEATURES = [
    FeatureDescription(
        "Give Seer access to your Datadog telemetry (logs, metrics, traces) while investigating issues.",
        IntegrationFeatures.MONITORING,
    ),
]

metadata = IntegrationMetadata(
    description=DESCRIPTION.strip(),
    features=FEATURES,
    author="The Sentry Team",
    noun=_("Organization"),
    issue_url="https://github.com/getsentry/sentry/issues/new?assignees=&labels=Component:%20Integrations&template=bug.yml&title=Datadog%20Integration%20Problem",
    source_url="https://github.com/getsentry/sentry/tree/master/src/sentry/integrations/datadog",
    aspects={},
)

_SITE_CHOICES = [(site, f"{site} ({region})") for site, region in DATADOG_VALID_SITES.items()]


class DatadogCredentials(TypedDict):
    api_key: str
    app_key: str
    site: str


class DatadogCredentialsSerializer(CamelSnakeSerializer[DatadogCredentials]):
    api_key = CharField(required=True, max_length=255)
    app_key = CharField(required=True, max_length=255)
    site = CharField(required=True, max_length=255)


class DatadogCredentialsApiStep:
    step_name = "datadog_credentials"

    def get_step_data(self, pipeline: IntegrationPipeline, request: HttpRequest) -> dict[str, Any]:
        return {}

    def get_serializer_cls(self) -> type:
        return DatadogCredentialsSerializer

    def handle_post(
        self,
        validated_data: DatadogCredentials,
        pipeline: IntegrationPipeline,
        request: HttpRequest,
    ) -> PipelineStepResult:
        pipeline.bind_state("config", dict(validated_data))
        return PipelineStepResult.advance()


class DatadogIntegration(IntegrationInstallation):
    @property
    def credentials(self) -> DatadogCredentials:
        return cast(DatadogCredentials, self.model.metadata)

    @property
    def api_key(self) -> str:
        return self.credentials["api_key"]

    @property
    def app_key(self) -> str:
        return self.credentials["app_key"]

    @property
    def site(self) -> str:
        return self.credentials["site"]

    def get_client(self) -> Any:
        raise NotImplementedError

    def get_organization_config(self) -> list[dict[str, Any]]:
        return [
            {
                "name": "site",
                "type": "select",
                "label": _("Datadog Site"),
                "choices": _SITE_CHOICES,
                "required": True,
            },
            {
                "name": "api_key",
                "type": "secret",
                "label": _("API Key"),
                "help": _("Leave blank to keep the current key."),
                "required": False,
                "formatMessageValue": False,
            },
            {
                "name": "app_key",
                "type": "secret",
                "label": _("Application Key"),
                "help": _("Leave blank to keep the current key."),
                "required": False,
                "formatMessageValue": False,
            },
        ]

    def get_config_data(self) -> Mapping[str, Any]:
        data = dict(super().get_config_data())
        data["site"] = self.credentials.get("site", "")
        return data

    def update_organization_config(self, data: MutableMapping[str, Any]) -> None:
        stored = self.credentials
        api_key = data.get("api_key") or stored["api_key"]
        app_key = data.get("app_key") or stored["app_key"]
        site = data.get("site") or stored["site"]

        validate_datadog_credentials(api_key, app_key, site)

        name = f"Datadog ({site})"
        new_metadata: DatadogCredentials = {"api_key": api_key, "app_key": app_key, "site": site}
        integration_service.update_integration(
            integration_id=self.model.id, name=name, metadata=dict(new_metadata)
        )
        self.model.name = name
        self.model.metadata = dict(new_metadata)


class DatadogIntegrationProvider(IntegrationProvider):
    key = IntegrationProviderSlug.DATADOG.value
    name = "Datadog (Seer)"
    metadata = metadata
    integration_cls = DatadogIntegration
    features = frozenset([IntegrationFeatures.MONITORING])
    requires_feature_flag = True
    allow_multiple = False

    def get_pipeline_api_steps(self) -> ApiPipelineSteps[IntegrationPipeline]:
        return [DatadogCredentialsApiStep()]

    def build_integration(self, state: Mapping[str, Any]) -> IntegrationData:
        config = state.get("config", {})
        if not config:
            raise IntegrationConfigurationError("Missing configuration data")

        api_key = config["api_key"]
        app_key = config["app_key"]
        site = config["site"]
        user = validate_datadog_credentials(api_key, app_key, site)
        credentials: DatadogCredentials = {"api_key": api_key, "app_key": app_key, "site": site}

        assert self.pipeline.organization is not None
        external_id = hashlib.sha256(
            f"{self.pipeline.organization.id}:{user['org_uuid']}".encode()
        ).hexdigest()

        return {
            "external_id": external_id,
            "name": f"Datadog ({site})",
            "metadata": dict(credentials),
        }

    def post_install(
        self,
        integration: Integration,
        organization: RpcOrganization,
        *,
        extra: dict[str, Any],
    ) -> None:
        site = integration.metadata.get("site")
        if site:
            integration.update(debug_data={**(integration.debug_data or {}), "site": site})


@org_monitoring_provider_registry.register(IntegrationProviderSlug.DATADOG.value)
class DatadogOrgMonitoringProvider(OrgMonitoringProvider):
    """Surfaces the org-level Datadog integration to Seer as a shared monitoring connection."""

    provider_key = IntegrationProviderSlug.DATADOG.value

    def build_connection(
        self, organization: Organization
    ) -> MonitoringProviderConnectionData | None:
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

        metadata = integration.metadata or {}
        api_key = metadata.get("api_key")
        app_key = metadata.get("app_key")
        base_url = mcp_base_url_for_site(metadata.get("site"))
        if not (api_key and app_key and base_url):
            logger.error(
                "seer.monitoring_providers.datadog_integration_invalid",
                extra={
                    "organization_id": organization.id,
                    "integration_id": integration.id,
                },
            )
            return None

        encrypted_api_key = encrypt_access_token_for_seer(api_key)
        encrypted_app_key = encrypt_access_token_for_seer(app_key)
        if not (encrypted_api_key and encrypted_app_key):
            return None

        return MonitoringProviderConnectionData(
            provider_key=self.provider_key,
            url=f"{base_url}{MCP_ENDPOINT_PATH}",
            encrypted_auth_headers={
                "DD-API-KEY": encrypted_api_key,
                "DD-APPLICATION-KEY": encrypted_app_key,
            },
            identity_id=None,
            auth_method="api_key",
            refreshable=False,
        )
