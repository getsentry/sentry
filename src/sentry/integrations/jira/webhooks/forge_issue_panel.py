from __future__ import annotations

from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import control_silo_endpoint
from sentry.constants import ObjectStatus
from sentry.integrations.jira.forge.invocation_token import (
    ForgeInvocationTokenError,
    ForgeSigningKeysUnavailableError,
    jira_cloud_id,
    verify_forge_request,
)
from sentry.integrations.models.organization_integration import OrganizationIntegration
from sentry.integrations.services.integration import integration_service
from sentry.integrations.types import IntegrationProviderSlug
from sentry.issues.services.issue import issue_service
from sentry.types.cell import find_cells_for_orgs

from .base import JiraWebhookBase

# The manifest's `jira:issuePanel` module. Only it renders on an issue, so only its
# invocations carry the issue in their signed context.
FORGE_ISSUE_PANEL_MODULE_KEY = "sentry-issue-panel"


@control_silo_endpoint
class JiraForgeIssuePanelWebhook(JiraWebhookBase):
    owner = ApiOwner.PROJECT_MANAGEMENT_INTEGRATIONS
    publish_status = {
        "POST": ApiPublishStatus.PRIVATE,
    }
    """
    Called by the Forge Linked Issues panel for the Sentry issues linked to the Jira issue
    it's rendered on. The issue comes from the invocation token's signed context, never
    from the request, so a Jira user can only see what's linked to an issue they're viewing.
    """

    def post(self, request: Request, *args: object, **kwargs: object) -> Response:
        try:
            invocation = verify_forge_request(request)
        except ForgeSigningKeysUnavailableError:
            return self.respond({"detail": "Unable to verify Forge invocation token"}, status=503)
        except ForgeInvocationTokenError:
            return self.respond({"detail": "Invalid Forge invocation token"}, status=401)

        if (
            invocation.module_key != FORGE_ISSUE_PANEL_MODULE_KEY
            or invocation.principal is None
            or invocation.issue_key is None
        ):
            return self.respond({"detail": "Not called from the issue panel"}, status=403)

        cloud_id = jira_cloud_id(invocation)
        if cloud_id is None:
            return self.respond({"detail": "Invalid Forge installation context"}, status=400)

        integration = integration_service.get_integration(
            provider=IntegrationProviderSlug.JIRA.value,
            external_id=cloud_id,
            status=ObjectStatus.ACTIVE,
        )
        # The integration must belong to the calling installation, so another trusted app
        # on the same site can't read its links.
        forge = (integration.metadata.get("forge") or {}) if integration else {}
        if integration is None or forge.get("installation_id") != invocation.installation_id:
            return self.respond({"detail": "Installation not found"}, status=404)

        organization_ids = list(
            OrganizationIntegration.objects.filter(
                integration_id=integration.id, status=ObjectStatus.ACTIVE
            ).values_list("organization_id", flat=True)
        )
        groups = []
        for cell_name in find_cells_for_orgs(organization_ids):
            groups.extend(
                issue_service.get_external_issue_groups(
                    cell_name=cell_name,
                    external_issue_key=invocation.issue_key,
                    integration_id=integration.id,
                )
                or []
            )

        return self.respond(
            {
                "groups": [
                    {"title": g.title, "url": g.title_url, "linkDate": g.link_date.isoformat()}
                    for g in groups
                ]
            }
        )
