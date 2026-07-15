from __future__ import annotations

import hashlib
from collections.abc import Mapping
from typing import Any, TypedDict, cast

from django.http.request import HttpRequest
from django.utils.translation import gettext_lazy as _
from rest_framework.fields import CharField

from sentry.api.serializers.rest_framework.base import CamelSnakeSerializer
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
from sentry.integrations.types import IntegrationProviderSlug
from sentry.organizations.services.organization import RpcOrganization
from sentry.pipeline.types import PipelineStepResult
from sentry.pipeline.views.base import ApiPipelineSteps
from sentry.shared_integrations.exceptions import IntegrationConfigurationError

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


class DatadogIntegrationProvider(IntegrationProvider):
    key = IntegrationProviderSlug.DATADOG.value
    name = "Datadog"
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
