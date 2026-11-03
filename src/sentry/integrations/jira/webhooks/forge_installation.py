from __future__ import annotations

from uuid import UUID

import orjson
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import control_silo_endpoint
from sentry.integrations.jira.forge.invocation_token import (
    ForgeInvocationTokenError,
    verify_forge_invocation_token,
)
from sentry.integrations.jira.tasks import sync_forge_installation
from sentry.utils.security.encrypted_field_key_store import FernetKeyStore

from .base import JiraWebhookBase

JIRA_API_BASE_URL = "https://api.atlassian.com/ex/jira/"


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
        scheme, _, token = request.headers.get("Authorization", "").partition(" ")
        if scheme.lower() != "bearer" or not token:
            return self.respond({"detail": "Missing Forge invocation token"}, status=401)
        try:
            invocation = verify_forge_invocation_token(token)
        except ForgeInvocationTokenError:
            return self.respond({"detail": "Invalid Forge invocation token"}, status=401)

        # Lifecycle events and scheduled triggers can arrive with an empty `context`, so
        # the site comes from apiBaseUrl, which every FIT carries. The system token is sent
        # to this URL, so it must be Atlassian's API for a single Jira site.
        api_base_url = invocation.api_base_url
        try:
            cloud_id: str | None = str(UUID(api_base_url.removeprefix(JIRA_API_BASE_URL)))
        except ValueError:
            cloud_id = None
        if api_base_url != f"{JIRA_API_BASE_URL}{cloud_id}" or invocation.cloud_id not in (
            None,
            cloud_id,
        ):
            return self.respond({"detail": "Invalid Forge installation context"}, status=400)

        system_token = request.headers.get("X-Forge-OAuth-System")
        if not system_token:
            return self.respond({"detail": "Missing Forge system token"}, status=400)

        # Encrypted so the token stays out of task arguments and error reports.
        key_id, fernet = FernetKeyStore.get_primary_fernet()
        encrypted_payload = fernet.encrypt(
            orjson.dumps(
                {
                    "installation_id": invocation.installation_id,
                    "cloud_id": cloud_id,
                    "api_base_url": invocation.api_base_url,
                    "system_token": system_token,
                }
            )
        ).decode()
        sync_forge_installation.delay(key_id=key_id, encrypted_payload=encrypted_payload)
        return self.respond(status=202)
