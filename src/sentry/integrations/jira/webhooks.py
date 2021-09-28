import logging
from typing import TYPE_CHECKING, Any, Mapping, Optional

from django.conf import settings
from django.views.decorators.csrf import csrf_exempt

from sentry.api.base import Endpoint
from sentry.integrations.atlassian_connect import (
    AtlassianConnectValidationError,
    get_integration_from_jwt,
)
from sentry.integrations.utils import sync_group_assignee_inbound

from .client import JiraApiClient, JiraCloud

if TYPE_CHECKING:
    from sentry.models import Integration

logger = logging.getLogger("sentry.integrations.jira.webhooks")


def get_assignee_email(
    integration: "Integration",
    assignee: Mapping[str, str],
    use_email_scope: bool = False,
) -> Optional[str]:
    """Get email from `assignee` or pull it from API (if we have the scope for it.)"""
    email = assignee.get("emailAddress")
    if not email and use_email_scope:
        account_id = assignee.get("accountId")
        client = JiraApiClient(
            integration.metadata["base_url"],
            JiraCloud(integration.metadata["shared_secret"]),
            verify_ssl=True,
        )
        email = client.get_email(account_id)
    return email


def handle_assignee_change(
    integration: "Integration",
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


class JiraIssueUpdatedWebhook(Endpoint):
    authentication_classes = ()
    permission_classes = ()

    @csrf_exempt
    def dispatch(self, request, *args, **kwargs):
        return super().dispatch(request, *args, **kwargs)

    def post(self, request, *args, **kwargs):
        try:
            token = request.META["HTTP_AUTHORIZATION"].split(" ", 1)[1]
        except (KeyError, IndexError):
            return self.respond(status=400)

        try:
            integration = get_integration_from_jwt(
                token, request.path, "jira", request.GET, method="POST"
            )
        except AtlassianConnectValidationError:
            return self.respond(status=400)

        data = request.data

        if not data.get("changelog"):
            logger.info("missing-changelog", extra={"integration_id": integration.id})
            return self.respond()

        handle_assignee_change(integration, data, use_email_scope=settings.JIRA_USE_EMAIL_SCOPE)
        handle_status_change(integration, data)

        return self.respond()
