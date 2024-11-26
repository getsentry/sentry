from __future__ import annotations

import logging
from collections.abc import Mapping
from typing import TYPE_CHECKING, Any

from sentry.integrations.services.integration.model import RpcIntegration
from sentry.integrations.services.integration.service import integration_service
from sentry.integrations.utils.sync import sync_group_assignee_inbound

if TYPE_CHECKING:
    from sentry.integrations.models.integration import Integration

logger = logging.getLogger(__name__)


def get_assignee_email(
    integration: RpcIntegration | Integration,
    assignee: Mapping[str, str],
) -> str | None:
    """Get email from `assignee`."""
    return assignee.get("emailAddress")


def handle_assignee_change(
    integration: RpcIntegration | Integration,
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


def handle_status_change(
    integration: RpcIntegration | Integration, data: Mapping[str, Any]
) -> None:
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

    org_integrations = integration_service.get_organization_integrations(
        integration_id=integration.id,
        providers=[integration.provider],
    )
    for oi in org_integrations:
        installation = integration.get_installation(oi.organization_id)

        if hasattr(installation, "sync_status_inbound"):
            installation.sync_status_inbound(
                issue_key, {"changelog": changelog, "issue": data["issue"]}
            )
