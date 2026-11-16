from __future__ import annotations

import time

import orjson
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import control_silo_endpoint
from sentry.integrations.jira.forge.invocation_token import (
    ForgeInvocationTokenError,
    jira_cloud_id,
    verify_forge_request,
)
from sentry.integrations.jira.tasks import sync_forge_installation
from sentry.utils.security.encrypted_field_key_store import FernetKeyStore

from .base import JiraWebhookBase

# Atlassian guarantees a system token is valid for at least this long.
FORGE_SYSTEM_TOKEN_MIN_TTL = 2 * 60 * 60


@control_silo_endpoint
class JiraForgeInstallationWebhook(JiraWebhookBase):
    owner = ApiOwner.PROJECT_MANAGEMENT_INTEGRATIONS
    publish_status = {
        "POST": ApiPublishStatus.PRIVATE,
    }
    """
    Called by Forge's install and upgrade lifecycle events, including when a Connect
    install upgrades to Forge, and by the hourly scheduled trigger. Every call carries
    a fresh system token, which is the only way a Forge remote receives one.
    """

    def post(self, request: Request, *args: object, **kwargs: object) -> Response:
        try:
            invocation = verify_forge_request(request)
        except ForgeInvocationTokenError:
            return self.respond({"detail": "Invalid Forge invocation token"}, status=401)

        # The system token is sent to apiBaseUrl, so it must be Atlassian's API for a
        # single Jira site.
        cloud_id = jira_cloud_id(invocation)
        if cloud_id is None:
            return self.respond({"detail": "Invalid Forge installation context"}, status=400)

        system_token = request.headers.get("X-Forge-OAuth-System")
        if not system_token:
            return self.respond({"detail": "Missing Forge system token"}, status=400)
        # The token is opaque, so track the guaranteed lifetime instead of decoding it.
        expires_at = int(time.time()) + FORGE_SYSTEM_TOKEN_MIN_TTL

        # Encrypted so the token stays out of task arguments and error reports.
        key_id, fernet = FernetKeyStore.get_primary_fernet()
        encrypted_payload = fernet.encrypt(
            orjson.dumps(
                {
                    "app_id": invocation.app_id,
                    "installation_id": invocation.installation_id,
                    "cloud_id": cloud_id,
                    "api_base_url": invocation.api_base_url,
                    "system_token": system_token,
                    "system_token_expires_at": expires_at,
                }
            )
        ).decode()
        sync_forge_installation.delay(key_id=key_id, encrypted_payload=encrypted_payload)
        return self.respond(status=202)
