from __future__ import annotations

import re
from collections.abc import Mapping, Sequence
from enum import StrEnum
from typing import Any, NotRequired, TypedDict

from django.http.request import HttpRequest
from django.utils.translation import gettext_lazy as _
from rest_framework.fields import CharField, ListField

from sentry.api.serializers.rest_framework.base import CamelSnakeSerializer
from sentry.integrations.base import (
    IntegrationData,
    IntegrationInstallation,
    IntegrationMetadata,
    IntegrationProvider,
)
from sentry.integrations.pipeline import IntegrationPipeline
from sentry.integrations.types import IntegrationProviderSlug
from sentry.pipeline.types import PipelineStepResult
from sentry.pipeline.views.base import ApiPipelineSteps
from sentry.shared_integrations.exceptions import IntegrationConfigurationError

GCP_PROJECT_ID_RE = re.compile(r"^[a-z][a-z0-9-]{4,28}[a-z0-9]$")

GCP_SA_EMAIL_BY_REGION: dict[str, str] = {
    "us": "service-seer@internal-sentry.iam.gserviceaccount.com",
    "us2": "service-seer@sentry-us2.iam.gserviceaccount.com",
    "de": "service-seer@sentry-eu-west3.iam.gserviceaccount.com",
}

DEFAULT_ENABLED_SERVICES: list[str] = ["monitoring", "logging"]

DESCRIPTION = """
Connect your Google Cloud Platform project so Seer can pull in infrastructure
telemetry using an org-level service account — shared across everyone in your
organization.
"""

metadata = IntegrationMetadata(
    description=DESCRIPTION.strip(),
    features=[],
    author="The Sentry Team",
    noun=_("Organization"),
    issue_url="https://github.com/getsentry/sentry/issues/new?assignees=&labels=Component:%20Integrations&template=bug.yml&title=GCP%20SA%20Integration%20Problem",
    source_url="https://github.com/getsentry/sentry/tree/master/src/sentry/integrations/gcp_sa",
    aspects={},
)


class GcpConnectionStatus(StrEnum):
    PENDING_VERIFICATION = "pending_verification"
    ACTIVE = "active"
    ERROR = "error"
    DISCONNECTED = "disconnected"


class GcpConfig(TypedDict):
    gcp_project_id: str
    display_name: str
    status: str
    enabled_services: list[str]
    verification_token: NotRequired[str]
    verified_at: NotRequired[str | None]
    last_verified_at: NotRequired[str | None]
    error_detail: NotRequired[str | None]
    created_by: NotRequired[int | None]


def validate_gcp_project_id(project_id: str) -> None:
    if not GCP_PROJECT_ID_RE.match(project_id):
        raise IntegrationConfigurationError(
            "Invalid GCP project ID. Must be 6-30 characters: lowercase letters, "
            "digits, and hyphens. Must start with a letter and cannot end with a hyphen."
        )


def sa_email_for_region(region: str) -> str | None:
    return GCP_SA_EMAIL_BY_REGION.get(region)


class GcpConfigSerializer(CamelSnakeSerializer["GcpConfigInput"]):
    gcp_project_id = CharField(required=True, max_length=30)
    display_name = CharField(required=False, max_length=255, default="")
    enabled_services = ListField(child=CharField(max_length=64), required=False)


class GcpConfigInput(TypedDict):
    gcp_project_id: str
    display_name: NotRequired[str]
    enabled_services: NotRequired[list[str]]


class GcpConfigApiStep:
    step_name = "gcp_sa_config"

    def get_step_data(self, pipeline: IntegrationPipeline, request: HttpRequest) -> dict[str, Any]:
        return {}

    def get_serializer_cls(self) -> type:
        return GcpConfigSerializer

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
    def config(self) -> GcpConfig:
        return self.model.metadata  # type: ignore[return-value]

    @property
    def gcp_project_id(self) -> str:
        return self.config["gcp_project_id"]

    @property
    def display_name(self) -> str:
        return self.config["display_name"]

    @property
    def status(self) -> str:
        return self.config["status"]

    @property
    def enabled_services(self) -> list[str]:
        return self.config["enabled_services"]

    def get_organization_config(self) -> Sequence[Any]:
        return []

    def get_client(self) -> Any:
        raise NotImplementedError

    def get_config_data(self) -> Mapping[str, str]:
        return {
            "gcp_project_id": self.gcp_project_id,
            "display_name": self.display_name,
            "status": self.status,
        }


class GcpIntegrationProvider(IntegrationProvider):
    key = IntegrationProviderSlug.GCP_SA.value
    name = "Google Cloud Platform"
    metadata = metadata
    integration_cls = GcpIntegration
    visible = False
    features = frozenset()
    requires_feature_flag = True
    allow_multiple = False

    def get_pipeline_api_steps(self) -> ApiPipelineSteps[IntegrationPipeline]:
        return [GcpConfigApiStep()]

    def build_integration(self, state: Mapping[str, Any]) -> IntegrationData:
        config = state.get("config", {})
        if not config:
            raise IntegrationConfigurationError("Missing configuration data")

        gcp_project_id = config["gcp_project_id"]
        validate_gcp_project_id(gcp_project_id)

        display_name = config.get("display_name") or gcp_project_id
        enabled_services = config.get("enabled_services") or list(DEFAULT_ENABLED_SERVICES)

        sa_config: GcpConfig = {
            "gcp_project_id": gcp_project_id,
            "display_name": display_name,
            "status": GcpConnectionStatus.PENDING_VERIFICATION,
            "enabled_services": enabled_services,
        }

        return {
            "external_id": gcp_project_id,
            "name": f"GCP ({gcp_project_id})",
            "metadata": dict(sa_config),
        }
