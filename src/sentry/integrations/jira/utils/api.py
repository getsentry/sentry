from __future__ import annotations

import logging
from typing import TYPE_CHECKING, Any, Mapping

from rest_framework import status
from rest_framework.response import Response

from sentry.integrations.utils import sync_group_assignee_inbound
from sentry.shared_integrations.exceptions import ApiError

from ..client import JiraApiClient, JiraCloud

if TYPE_CHECKING:
    from sentry.models import Integration


logger = logging.getLogger(__name__)


def _get_client(integration: Integration) -> JiraApiClient:
    return JiraApiClient(
        integration.metadata["base_url"],
        JiraCloud(integration.metadata["shared_secret"]),
        verify_ssl=True,
    )


def set_badge(integration: Integration, issue_key: str, group_link_num: int) -> Response:
    client = _get_client(integration)
    return client.set_issue_property(issue_key, group_link_num)


def get_assignee_email(
    integration: Integration,
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
    integration: Integration,
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
    # TODO(steve) check display name
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

    for org_id in integration.organizations.values_list("id", flat=True):
        installation = integration.get_installation(org_id)

        installation.sync_status_inbound(
            issue_key, {"changelog": changelog, "issue": data["issue"]}
        )


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
