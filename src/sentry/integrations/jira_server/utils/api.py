from __future__ import annotations

import logging
from typing import TYPE_CHECKING, Any, Mapping

from sentry.integrations.utils import sync_group_assignee_inbound
from sentry.shared_integrations.exceptions import IntegrationError

from ..client import JiraServerClient

if TYPE_CHECKING:
    from sentry.models import Identity, Integration, OrganizationIntegration

logger = logging.getLogger(__name__)


def _get_client(integration: Integration) -> JiraServerClient:
    oi = OrganizationIntegration.objects.get(integration_id=integration.id)
    try:
        default_identity = Identity.objects.get(id=oi.default_auth_id)
    except Identity.DoesNotExist:
        raise IntegrationError("Identity not found.")

    return JiraServerClient(
        integration.metadata["base_url"],
        default_identity.data,
        verify_ssl=True,
    )


def get_assignee_email(
    integration: Integration,
    assignee: Mapping[str, str],
) -> str | None:
    """Get email from `assignee`."""
    return assignee.get("emailAddress")


def handle_assignee_change(
    integration: Integration,
    data: Mapping[str, Any],
) -> None:
    assignee_changed = any(
        item for item in data["changelog"]["items"] if item["field"] == "assignee"
    )
    if not assignee_changed:
        return

    fields = data["issue"]["fields"]

    # If there is no assignee, assume it was unassigned.
    assignee = fields.get("assignee")
    issue_key = data["issue"]["key"]

    if assignee is None:
        sync_group_assignee_inbound(integration, None, issue_key, assign=False)
        return

    email = get_assignee_email(integration, assignee)
    if not email:
        logger.info(
            "missing-assignee-email",
            extra={"issue_key": issue_key, "integration_id": integration.id},
        )
        return

    sync_group_assignee_inbound(integration, email, issue_key, assign=True)


def handle_status_change(integration, data):
    status_changed = any(item for item in data["changelog"]["items"] if item["field"] == "status")
    if not status_changed:
        return

    issue_key = data["issue"]["key"]

    try:
        changelog = next(item for item in data["changelog"]["items"] if item["field"] == "status")
    except StopIteration:
        logger.info(
            "missing-changelog-status",
            extra={"issue_key": issue_key, "integration_id": integration.id},
        )
        return

    for org_id in integration.organizationintegration_set.values_list("organization_id", flat=True):
        installation = integration.get_installation(org_id)

        installation.sync_status_inbound(
            issue_key, {"changelog": changelog, "issue": data["issue"]}
        )
