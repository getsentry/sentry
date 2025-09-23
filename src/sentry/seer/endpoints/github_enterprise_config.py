import logging
from typing import Any

from cryptography.fernet import Fernet
from django.conf import settings
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.authentication import AuthenticationSiloLimit
from sentry.api.base import Endpoint, control_silo_endpoint
from sentry.constants import ObjectStatus
from sentry.integrations.github_enterprise.integration import GitHubEnterpriseIntegration
from sentry.integrations.services.integration import integration_service
from sentry.integrations.types import IntegrationProviderSlug
from sentry.seer.endpoints.seer_rpc import SeerRpcSignatureAuthentication

logger = logging.getLogger(__name__)


@control_silo_endpoint
class GitHubEnterpriseConfigEndpoint(Endpoint):
    """
    Control silo endpoint for getting GitHub Enterprise integration configuration.
    This is specifically for Seer to access integration data without RPC issues.
    """

    publish_status = {
        "POST": ApiPublishStatus.EXPERIMENTAL,
    }
    owner = ApiOwner.ML_AI
    authentication_classes = (SeerRpcSignatureAuthentication,)
    permission_classes = ()

    def post(self, request: Request) -> Response:
        """Get GitHub Enterprise integration configuration."""
        try:
            organization_id = request.data.get("organization_id")
            integration_id = request.data.get("integration_id")

            if not organization_id or not integration_id:
                return Response(
                    {"success": False, "error": "Missing organization_id or integration_id"},
                    status=400
                )

            result = get_github_enterprise_integration_config(
                organization_id=organization_id,
                integration_id=integration_id
            )
            return Response(result)
        except Exception as e:
            logger.exception("Error in GitHubEnterpriseConfigEndpoint: %s", e)
            return Response({"success": False, "error": str(e)}, status=500)


def get_github_enterprise_integration_config(
    *, organization_id: int, integration_id: int
) -> dict[str, Any]:
    """Get GitHub Enterprise integration configuration for Seer."""
    if not settings.SEER_GHE_ENCRYPT_KEY:
        logger.error("Cannot encrypt access token without SEER_GHE_ENCRYPT_KEY")
        return {"success": False, "error": "SEER_GHE_ENCRYPT_KEY not configured"}

    try:
        # Step 1: Get the integration directly (we're in CONTROL silo)
        logger.info("Getting integration %s for organization %s", integration_id, organization_id)
        integration = integration_service.get_integration(
            integration_id=integration_id,
            provider=IntegrationProviderSlug.GITHUB_ENTERPRISE.value,
            organization_id=organization_id,
            status=ObjectStatus.ACTIVE,
        )
        if integration is None:
            logger.error("Integration %s does not exist for organization %s", integration_id, organization_id)
            return {"success": False, "error": "Integration not found"}

        logger.info("Successfully retrieved integration %s", integration.id)

        # Step 2: Create the installation
        try:
            installation = integration.get_installation(organization_id=organization_id)
            assert isinstance(installation, GitHubEnterpriseIntegration)
            logger.info("Successfully created installation for integration %s", integration.id)
        except Exception as e:
            logger.exception("Failed to create installation for integration %s: %s", integration.id, e)
            return {"success": False, "error": f"Failed to create installation: {e}"}

        # Step 3: Get the client
        try:
            client = installation.get_client()
            logger.info("Successfully created client for integration %s", integration.id)
        except Exception as e:
            logger.exception("Failed to create client for integration %s: %s", integration.id, e)
            return {"success": False, "error": f"Failed to create client: {e}"}

        # Step 4: Get access token (this might make external API calls)
        try:
            access_token_data = client.get_access_token()
            if not access_token_data:
                logger.error("No access token found for integration %s", integration.id)
                return {"success": False, "error": "No access token found"}
            logger.info("Successfully retrieved access token for integration %s", integration.id)
        except Exception as e:
            logger.exception("Failed to get access token for integration %s: %s", integration.id, e)
            return {"success": False, "error": f"Failed to get access token: {e}"}

        # Step 5: Encrypt the access token
        try:
            fernet = Fernet(settings.SEER_GHE_ENCRYPT_KEY.encode("utf-8"))
            access_token = access_token_data["access_token"]
            encrypted_access_token = fernet.encrypt(access_token.encode("utf-8")).decode("utf-8")
            logger.info("Successfully encrypted access token for integration %s", integration.id)
        except Exception as e:
            logger.exception("Failed to encrypt access token for integration %s: %s", integration.id, e)
            return {"success": False, "error": f"Failed to encrypt access token: {e}"}

        return {
            "success": True,
            "base_url": f"https://{installation.model.metadata['domain_name'].split('/')[0]}/api/v3",
            "verify_ssl": installation.model.metadata["installation"]["verify_ssl"],
            "encrypted_access_token": encrypted_access_token,
            "permissions": access_token_data["permissions"],
        }
    except Exception as e:
        logger.exception("Unexpected error getting GitHub Enterprise integration config: %s", e)
        return {"success": False, "error": f"Unexpected error: {e}"}
