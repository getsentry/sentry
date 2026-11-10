from __future__ import annotations

import logging
from collections.abc import Callable, Mapping
from functools import partial
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

        # Same order as the Connect webhook: rekey first, since the other handlers look
        # the issue up by its new key.
        handlers: list[tuple[str, Callable[[Any, Mapping[str, Any]], None]]] = [
            ("issue_moved", handle_issue_moved),
            (
                "assignee_change",
                partial(handle_assignee_change, use_email_scope=settings.JIRA_USE_EMAIL_SCOPE),
            ),
            ("status_change", handle_status_change),
        ]
        for name, handler in handlers:
            # Control outboxes retry without limit, so re-raising would block every later
            # event for this integration. A failure is reported and only that change is
            # dropped, so one handler can't cost the event its other changes.
            try:
                handler(integration, event)
            except Exception as e:
                logger.warning(
                    "jira.forge.issue_updated.failed",
                    extra={"integration_id": integration.id, "handler": name},
                    exc_info=True,
                )
                sentry_sdk.capture_exception(e)
