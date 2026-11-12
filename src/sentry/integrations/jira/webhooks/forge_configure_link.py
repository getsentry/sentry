from __future__ import annotations

import logging

from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import control_silo_endpoint
from sentry.constants import ObjectStatus
from sentry.integrations.jira.forge.client import ForgeUserClient
from sentry.integrations.jira.forge.invocation_token import (
    ForgeInvocationTokenError,
    ForgeSigningKeysUnavailableError,
    jira_cloud_id,
    verify_forge_request,
)
from sentry.integrations.jira.views.sentry_installation import build_configure_link
from sentry.integrations.services.integration import integration_service
from sentry.integrations.types import IntegrationProviderSlug
from sentry.shared_integrations.exceptions import ApiError

from .base import JiraWebhookBase

# The Forge config page (`jira:adminPage` with `useAsConfig`). It lives in Jira's admin
# settings, but Atlassian doesn't document that access to it is enforced, so the caller
# must also be a Jira admin.
FORGE_CONFIGURE_MODULE_KEY = "sentry-configure"
# Sent for invocations with a user in session when the endpoint enables `appUserToken`.
FORGE_USER_TOKEN_HEADER = "X-Forge-OAuth-User"

logger = logging.getLogger(__name__)


@control_silo_endpoint
class JiraForgeConfigureLinkWebhook(JiraWebhookBase):
    owner = ApiOwner.PROJECT_MANAGEMENT_INTEGRATIONS
    publish_status = {
        "POST": ApiPublishStatus.PRIVATE,
    }
    """
    Called by the Forge config page to get the link that connects the Jira site to a
    Sentry organization. Only Forge-only integrations, keyed by cloud ID, are found here;
    Connect installs keep using the Connect config page until they're rekeyed.
    """

    def post(self, request: Request, *args: object, **kwargs: object) -> Response:
        try:
            invocation = verify_forge_request(request)
        except ForgeSigningKeysUnavailableError:
            return self.respond({"detail": "Unable to verify Forge invocation token"}, status=503)
        except ForgeInvocationTokenError:
            return self.respond({"detail": "Invalid Forge invocation token"}, status=401)

        # Other modules are visible to every Jira user, so only the config page may mint links.
        if invocation.module_key != FORGE_CONFIGURE_MODULE_KEY or invocation.principal is None:
            return self.respond({"detail": "Not the Forge config page"}, status=403)

        cloud_id = jira_cloud_id(invocation)
        if cloud_id is None:
            return self.respond({"detail": "Invalid Forge installation context"}, status=400)

        # Asked as the caller, with their own token: checking another user's permissions
        # as the app needs the app itself to be a Jira admin.
        user_token = request.headers.get(FORGE_USER_TOKEN_HEADER)
        if not user_token:
            return self.respond({"detail": "Missing Forge user token"}, status=403)
        try:
            is_admin = ForgeUserClient(invocation.api_base_url, user_token).is_jira_admin()
        except ApiError as e:
            logger.warning(
                "jira.forge.configure_link.permission_check_failed",
                extra={"cloud_id": cloud_id, "status": e.code},
            )
            return self.respond({"detail": "Unable to check Jira permissions"}, status=502)
        if not is_admin:
            return self.respond({"detail": "Only Jira admins can connect Sentry"}, status=403)

        integration = integration_service.get_integration(
            provider=IntegrationProviderSlug.JIRA.value,
            external_id=cloud_id,
            status=ObjectStatus.ACTIVE,
        )
        # The installation task may not have finished yet. The integration must also belong
        # to the calling installation, so another trusted app on the same site can't mint
        # links for it.
        forge = (integration.metadata.get("forge") or {}) if integration else {}
        if integration is None or forge.get("installation_id") != invocation.installation_id:
            return self.respond({"detail": "Installation not found"}, status=404)

        return self.respond({"link": build_configure_link(integration.external_id)})
