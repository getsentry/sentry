from __future__ import annotations

from typing import Any

from sentry.integrations.jira.tasks import apply_forge_issue_event
from sentry.integrations.services.jira_forge.service import JiraForgeService


class DatabaseBackedJiraForgeService(JiraForgeService):
    def handle_issue_updated(
        self, *, cell_name: str, integration_id: int, event: dict[str, Any]
    ) -> None:
        # Queued rather than applied here, so a temporary Jira failure is retried by the
        # task instead of blocking the control outbox behind it.
        apply_forge_issue_event.delay(integration_id=integration_id, event=event)
