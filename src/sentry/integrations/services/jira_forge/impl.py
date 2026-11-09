from __future__ import annotations

import logging
from typing import Any

import sentry_sdk
from django.conf import settings

from sentry.constants import ObjectStatus
from sentry.integrations.jira.utils import (
    handle_assignee_change,
    handle_issue_moved,
    handle_status_change,
)
from sentry.integrations.services.integration import integration_service
from sentry.integrations.services.jira_forge.service import JiraForgeService
from sentry.integrations.utils.scope import bind_org_context_from_integration

logger = logging.getLogger(__name__)


class DatabaseBackedJiraForgeService(JiraForgeService):
    def handle_issue_updated(
        self, *, cell_name: str, integration_id: int, event: dict[str, Any]
    ) -> None:
        integration = integration_service.get_integration(
            integration_id=integration_id, status=ObjectStatus.ACTIVE
        )
        if integration is None:
            return
        bind_org_context_from_integration(integration.id, {"webhook": "forge_issue_updated"})

        # Control outboxes retry without limit, so re-raising would block every later
        # event for this integration. Failures are reported and the event is dropped.
        try:
            # Same order as the Connect webhook: rekey first, since the other
            # handlers look the issue up by its new key.
            handle_issue_moved(integration, event)
            handle_assignee_change(
                integration, event, use_email_scope=settings.JIRA_USE_EMAIL_SCOPE
            )
            handle_status_change(integration, event)
        except Exception as e:
            logger.warning(
                "jira.forge.issue_updated.failed",
                extra={"integration_id": integration.id},
                exc_info=True,
            )
            sentry_sdk.capture_exception(e)
