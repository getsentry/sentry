from __future__ import annotations

import logging
from collections.abc import Mapping, MutableMapping
from typing import Any

from django.conf import settings
from django.utils.translation import gettext_lazy as _

from sentry.constants import ObjectStatus
from sentry.identity.oauth2 import OAuth2ApiStep, OAuth2ApiStepError
from sentry.integrations.base import (
    FeatureDescription,
    IntegrationData,
    IntegrationFeatures,
    IntegrationInstallation,
    IntegrationMetadata,
    IntegrationProvider,
)
from sentry.integrations.linear.client import (
    LINEAR_AUTHORIZE_URL,
    LINEAR_MCP_URL,
    LINEAR_SCOPES,
    LINEAR_TOKEN_URL,
    LinearClient,
    LinearWorkspace,
    exchange_authorization_code,
    validate_linear_access_token,
)
from sentry.integrations.models.organization_integration import OrganizationIntegration
from sentry.integrations.pipeline import IntegrationPipeline
from sentry.integrations.services.integration import integration_service
from sentry.integrations.types import IntegrationProviderSlug
from sentry.models.organization import Organization
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

DESCRIPTION = """
Connect your Linear workspace so Seer can work with your issues, projects, and comments while
investigating issues — shared across everyone in your organization. Sentry requests read and
write access to your Linear workspace.
"""

FEATURES = [
    FeatureDescription(
        "Give Seer read and write access to your Linear issues, projects, and comments while investigating issues.",
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


class LinearOAuthApiStep(OAuth2ApiStep):
    def _exchange_token(self, code: str) -> dict[str, Any]:
        # Check the grant before advancing so a failed connection can be retried in the popup.
        try:
            token = exchange_authorization_code(code, absolute_uri(self.redirect_url))
            workspace = validate_linear_access_token(token.access_token.get_secret_value())
        except IntegrationConfigurationError as e:
            raise OAuth2ApiStepError(str(e)) from None
        return {"token": token.as_metadata(), "workspace": workspace}


class LinearIntegration(IntegrationInstallation):
    def get_client(self) -> LinearClient:
        return LinearClient(self.model)

    def get_config_data(self) -> Mapping[str, Any]:
        return {}

    def update_organization_config(self, data: MutableMapping[str, Any]) -> None:
        if data:
            raise IntegrationConfigurationError(
                "Reconnect Linear to change this integration's authorization."
            )

    def get_dynamic_display_information(self) -> Mapping[str, Any]:
        return {
            "configure_integration": {
                "instructions": [
                    _(
                        "Seer has read and write access to this Linear workspace. "
                        "Reconnect Linear to update its authorization."
                    )
                ]
            }
        }

    def uninstall(self) -> None:
        try:
            self.get_client().revoke_access(self.organization_id)
        except Exception as e:
            # A provider outage must not prevent disconnecting. Do not log token response bodies.
            logger.warning(
                "linear.uninstall.revoke_failed",
                extra={"integration_id": self.model.id, "error_type": type(e).__name__},
            )


class LinearIntegrationProvider(IntegrationProvider):
    key = IntegrationProviderSlug.LINEAR.value
    name = "Linear for Seer"
    metadata = metadata
    integration_cls = LinearIntegration
    features = frozenset([IntegrationFeatures.SEER_CONTEXT])
    requires_feature_flag = True
    allow_multiple = False

    def get_pipeline_api_steps(self) -> ApiPipelineSteps[IntegrationPipeline]:
        return [
            LinearOAuthApiStep(
                authorize_url=LINEAR_AUTHORIZE_URL,
                access_token_url=LINEAR_TOKEN_URL,
                client_id=settings.LINEAR_CLIENT_ID,
                client_secret=settings.LINEAR_CLIENT_SECRET,
                # Linear expects a comma-separated scope list.
                scope=",".join(LINEAR_SCOPES),
                redirect_url="/extensions/linear/setup/",
                bind_key="oauth_data",
                extra_authorize_params={"actor": "app", "prompt": "consent"},
            )
        ]

    def build_integration(self, state: Mapping[str, Any]) -> IntegrationData:
        data = state.get("oauth_data")
        if not data:
            raise IntegrationConfigurationError("Missing Linear authorization data.")

        assert self.pipeline.organization is not None
        if (
            OrganizationIntegration.objects.filter(
                organization_id=self.pipeline.organization.id, integration__provider=self.key
            )
            .exclude(integration__external_id=data["workspace"]["id"])
            .exists()
        ):
            raise IntegrationConfigurationError(
                "Remove the current Linear connection before connecting a different workspace."
            )

        return {
            # The app is installed once per Linear workspace. Share its rotating grant and lock
            # across Sentry organizations that have each authorized access to that workspace.
            "external_id": data["workspace"]["id"],
            "name": _integration_name(data["workspace"]),
            "metadata": {
                "workspace_id": data["workspace"]["id"],
                "app_user_id": data["workspace"]["app_user_id"],
                **data["token"],
            },
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

        token = integration_service.get_access_token(
            integration_id=integration.id, organization_id=organization.id
        )
        if token is None:
            return None

        encrypted_auth_header = encrypt_access_token_for_seer(f"Bearer {token.token}")
        if not encrypted_auth_header:
            return None

        return [
            HeaderAuthConnectionData(
                provider_key=self.provider_key,
                url=LINEAR_MCP_URL,
                encrypted_auth_headers={"Authorization": encrypted_auth_header},
                identity_id=None,
                integration_id=integration.id,
                auth_method="oauth",
                refreshable=True,
            )
        ]
