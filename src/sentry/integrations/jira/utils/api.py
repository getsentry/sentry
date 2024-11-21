from __future__ import annotations

import logging
from collections.abc import Mapping
from typing import Any

from rest_framework import status
from rest_framework.response import Response

from sentry.integrations.services.integration import integration_service
from sentry.integrations.services.integration.model import RpcIntegration
from sentry.integrations.utils.sync import sync_group_assignee_inbound
from sentry.shared_integrations.exceptions import ApiError

from ...mixins.issues import IssueSyncIntegration
from ...project_management.metrics import (
    ProjectManagementActionType,
    ProjectManagementEvent,
    ProjectManagementHaltReason,
)
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
    issue_key = data["issue"]["key"]

    log_context = {"issue_key": issue_key, "integration_id": integration.id}
    assignee_changed = any(
        item for item in data["changelog"]["items"] if item["field"] == "assignee"
    )
    if not assignee_changed:
        logger.info("jira.assignee-not-in-changelog", extra=log_context)
        return

    # If there is no assignee, assume it was unassigned.
    fields = data["issue"]["fields"]
    assignee = fields.get("assignee")

    if assignee is None:
        sync_group_assignee_inbound(integration, None, issue_key, assign=False)
        return

    email = get_assignee_email(integration, assignee, use_email_scope)
    if not email:
        logger.info("jira.missing-assignee-email", extra=log_context)
        return

    sync_group_assignee_inbound(integration, email, issue_key, assign=True)


# TODO(Gabe): Consolidate this with VSTS's implementation, create DTO for status
# changes.
def handle_status_change(integration: RpcIntegration, data: Mapping[str, Any]) -> None:
    with ProjectManagementEvent(
        action_type=ProjectManagementActionType.INBOUND_STATUS_SYNC, integration=integration
    ).capture() as lifecycle:
        issue_key = data["issue"]["key"]
        status_changed = any(
            item for item in data["changelog"]["items"] if item["field"] == "status"
        )
        log_context = {"issue_key": issue_key, "integration_id": integration.id}

        if not status_changed:
            logger.info("jira.handle_status_change.unchanged", extra=log_context)
            return

        try:
            changelog = next(
                item for item in data["changelog"]["items"] if item["field"] == "status"
            )
        except StopIteration:
            lifecycle.record_halt(
                ProjectManagementHaltReason.SYNC_INBOUND_MISSING_CHANGELOG_STATUS, extra=log_context
            )
            logger.info("jira.missing-changelog-status", extra=log_context)
            return

        result = integration_service.organization_contexts(integration_id=integration.id)
        for oi in result.organization_integrations:
            install = integration.get_installation(organization_id=oi.organization_id)
            if isinstance(install, IssueSyncIntegration):
                install.sync_status_inbound(
                    issue_key, {"changelog": changelog, "issue": data["issue"]}
                )
            else:
                lifecycle.record_halt(
                    ProjectManagementHaltReason.SYNC_NON_SYNC_INTEGRATION_PROVIDED,
                    extra=log_context,
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
