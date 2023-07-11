from __future__ import annotations

import logging
from typing import Any, Mapping

from rest_framework import status
from rest_framework.response import Response

from sentry.integrations.utils import sync_group_assignee_inbound
from sentry.services.hybrid_cloud.integration import integration_service
from sentry.services.hybrid_cloud.integration.model import RpcIntegration
from sentry.shared_integrations.exceptions import ApiError

from ...mixins import IssueSyncMixin
from ..client import JiraCloudClient

logger = logging.getLogger(__name__)


def _get_client(integration: RpcIntegration) -> JiraCloudClient:
    return JiraCloudClient(
        integration=integration,
        verify_ssl=True,
    )


def set_badge(integration: RpcIntegration, issue_key: str, group_link_num: int) -> Response:
    client = _get_client(integration)
    return client.set_issue_property(issue_key, group_link_num)


def get_assignee_email(
    integration: RpcIntegration,
    assignee: Mapping[str, str],
    use_email_scope: bool = False,
) -> str | None:
    """Get email from `assignee` or pull it from API (if we have the scope for it.)"""
    email = assignee.get("emailAddress")
    if not email and use_email_scope:
        account_id = assignee.get("accountId")
        client = _get_client(integration)
        email = client.get_email(account_id)
    return email


def handle_assignee_change(
    integration: RpcIntegration,
    data: Mapping[str, Any],
    use_email_scope: bool = False,
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

    email = get_assignee_email(integration, assignee, use_email_scope)
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

    _, org_integrations = integration_service.get_organization_contexts(
        integration_id=integration.id
    )
    for oi in org_integrations:
        install = integration_service.get_installation(
            integration=integration, organization_id=oi.organization_id
        )
        if isinstance(install, IssueSyncMixin):
            install.sync_status_inbound(issue_key, {"changelog": changelog, "issue": data["issue"]})


def handle_jira_api_error(error: ApiError, message: str = "") -> Mapping[str, str] | None:
    if error.code in (
        status.HTTP_500_INTERNAL_SERVER_ERROR,
        status.HTTP_503_SERVICE_UNAVAILABLE,
    ):
        return {"error_message": f"Cannot reach host{message}."}

    if error.code in (
        status.HTTP_403_FORBIDDEN,
        status.HTTP_404_NOT_FOUND,
    ):
        return {"error_message": f"User lacks permissions{message}."}

    return None
