from __future__ import annotations

import base64
import hashlib
import logging
import secrets
from collections.abc import Mapping, MutableMapping
from typing import Any
from urllib.parse import urlencode

from django.conf import settings
from django.http import HttpRequest
from django.utils.crypto import constant_time_compare
from django.utils.translation import gettext_lazy as _

from sentry import features
from sentry.constants import ObjectStatus
from sentry.identity.oauth2 import ERR_INVALID_STATE, OAuth2ApiSerializer
from sentry.integrations.base import (
    FeatureDescription,
    IntegrationData,
    IntegrationFeatures,
    IntegrationInstallation,
    IntegrationMetadata,
    IntegrationProvider,
)
from sentry.integrations.models.organization_integration import OrganizationIntegration
from sentry.integrations.pipeline import IntegrationPipeline
from sentry.integrations.services.integration import integration_service
from sentry.integrations.supabase.client import (
    SUPABASE_AUTHORIZATION_ERROR,
    SUPABASE_AUTHORIZE_URL,
    SUPABASE_MCP_RESOURCE,
    SUPABASE_MCP_URL,
    SupabaseClient,
    exchange_authorization_code,
    validate_supabase_access_token,
)
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
from sentry.utils.http import absolute_uri

logger = logging.getLogger(__name__)

SUPABASE_REDIRECT_URL = "/extensions/supabase/setup/"

metadata = IntegrationMetadata(
    description=(
        "Connect your Supabase organization so Seer can investigate logs and security and "
        "performance advisors across its projects. The connection is read-only and shared "
        "with your Sentry organization."
    ),
    features=[
        FeatureDescription(
            "Give Seer access to logs and advisors across your Supabase organization's projects.",
            IntegrationFeatures.SEER_CONTEXT,
        )
    ],
    author="The Sentry Team",
    noun=_("Organization"),
    issue_url="https://github.com/getsentry/sentry/issues/new?assignees=&labels=Component:%20Integrations&template=bug.yml&title=Supabase%20Integration%20Problem",
    source_url="https://github.com/getsentry/sentry/tree/master/src/sentry/integrations/supabase",
    aspects={},
)


class SupabaseOAuthApiStep:
    step_name = "oauth_login"

    def get_step_data(self, pipeline: IntegrationPipeline, request: HttpRequest) -> dict[str, str]:
        verifier = pipeline.fetch_state("supabase_code_verifier")
        state = pipeline.fetch_state("supabase_oauth_state")
        if not verifier or not state:
            verifier = secrets.token_urlsafe(64)
            state = secrets.token_urlsafe(32)
            pipeline.bind_state("supabase_code_verifier", verifier)
            pipeline.bind_state("supabase_oauth_state", state)
        challenge = base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).rstrip(
            b"="
        )
        params = urlencode(
            {
                "client_id": settings.SUPABASE_FOR_SEER_CLIENT_ID,
                "response_type": "code",
                "state": state,
                "redirect_uri": absolute_uri(SUPABASE_REDIRECT_URL),
                "code_challenge": challenge.decode(),
                "code_challenge_method": "S256",
                "resource": SUPABASE_MCP_RESOURCE,
            }
        )
        return {"oauthUrl": f"{SUPABASE_AUTHORIZE_URL}?{params}"}

    def get_serializer_cls(self) -> type[OAuth2ApiSerializer]:
        return OAuth2ApiSerializer

    def handle_post(
        self,
        validated_data: dict[str, str],
        pipeline: IntegrationPipeline,
        request: HttpRequest,
    ) -> PipelineStepResult:
        state = pipeline.fetch_state("supabase_oauth_state")
        if not state or not constant_time_compare(validated_data["state"], state):
            return PipelineStepResult.error(ERR_INVALID_STATE)
        verifier = pipeline.fetch_state("supabase_code_verifier")
        if not verifier:
            return PipelineStepResult.error(SUPABASE_AUTHORIZATION_ERROR)
        try:
            token = exchange_authorization_code(
                validated_data["code"], absolute_uri(SUPABASE_REDIRECT_URL), verifier
            )
            organization = validate_supabase_access_token(token.access_token.get_secret_value())
        except IntegrationConfigurationError as error:
            return PipelineStepResult.error(str(error))
        pipeline.bind_state(
            "oauth_data", {"token": token.as_metadata(), "organization": organization}
        )
        return PipelineStepResult.advance()


class SupabaseIntegration(IntegrationInstallation):
    def get_client(self) -> SupabaseClient:
        return SupabaseClient(self.model)

    def get_config_data(self) -> Mapping[str, Any]:
        return {}

    def update_organization_config(self, data: MutableMapping[str, Any]) -> None:
        if data:
            raise IntegrationConfigurationError(
                "Reconnect Supabase to change this integration's authorization."
            )

    def get_dynamic_display_information(self) -> Mapping[str, Any]:
        return {
            "configure_integration": {
                "instructions": [
                    _(
                        "Seer can read logs and advisors across this Supabase organization's "
                        "projects. Reconnect Supabase to update its authorization."
                    )
                ]
            }
        }

    def uninstall(self) -> None:
        try:
            self.get_client().revoke_access(self.organization_id)
        except Exception as error:
            # Provider downtime must not prevent disconnecting or expose token responses.
            logger.warning(
                "supabase.uninstall.revoke_failed",
                extra={"integration_id": self.model.id, "error_type": type(error).__name__},
            )


class SupabaseIntegrationProvider(IntegrationProvider):
    key = IntegrationProviderSlug.SUPABASE.value
    name = "Supabase for Seer"
    metadata = metadata
    integration_cls = SupabaseIntegration
    features = frozenset([IntegrationFeatures.SEER_CONTEXT])
    requires_feature_flag = True
    allow_multiple = False

    def get_pipeline_api_steps(self) -> ApiPipelineSteps[IntegrationPipeline]:
        return [SupabaseOAuthApiStep()]

    def build_integration(self, state: Mapping[str, Any]) -> IntegrationData:
        data = state.get("oauth_data")
        if not data:
            raise IntegrationConfigurationError("Missing Supabase authorization data.")
        assert self.pipeline.organization is not None
        organization = data["organization"]
        if (
            OrganizationIntegration.objects.filter(
                organization_id=self.pipeline.organization.id, integration__provider=self.key
            )
            .exclude(integration__external_id=organization["slug"])
            .exists()
        ):
            raise IntegrationConfigurationError(
                "Remove the current Supabase connection before connecting a different organization."
            )
        return {
            "external_id": organization["slug"],
            "name": f"Supabase ({organization['name']})",
            "metadata": {"organization_slug": organization["slug"], **data["token"]},
        }


@org_monitoring_provider_registry.register(IntegrationProviderSlug.SUPABASE.value)
class SupabaseOrgMonitoringProvider(OrgMonitoringProvider):
    provider_key = IntegrationProviderSlug.SUPABASE.value

    def build_connection(self, organization: Organization) -> list[HeaderAuthConnectionData] | None:
        if not features.has("organizations:integrations-supabase", organization):
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
        token = integration_service.get_access_token(
            integration_id=integration.id, organization_id=organization.id
        )
        if token is None:
            return None
        encrypted_header = encrypt_access_token_for_seer(f"Bearer {token.token}")
        if not encrypted_header:
            return None
        return [
            HeaderAuthConnectionData(
                provider_key=self.provider_key,
                url=SUPABASE_MCP_URL,
                encrypted_auth_headers={"Authorization": encrypted_header},
                identity_id=None,
                integration_id=integration.id,
                auth_method="oauth",
                refreshable=True,
            )
        ]
