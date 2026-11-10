from typing import Any
from unittest.mock import MagicMock, patch

from django.conf import settings

from sentry.constants import ObjectStatus
from sentry.integrations.services.jira_forge import jira_forge_service
from sentry.integrations.utils.external_issue_key import PROVIDER_ISSUE_ID_KEY
from sentry.silo.base import SiloMode
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import all_silo_test, assume_test_silo_mode

EVENT: dict[str, Any] = {
    "issue": {"id": "10001", "key": "APP-1", "fields": {}},
    "changelog": {"id": "20001", "items": [{"field": "status", "toString": "Done"}]},
}


@all_silo_test
@patch("sentry.integrations.services.jira_forge.impl.handle_status_change")
@patch("sentry.integrations.services.jira_forge.impl.handle_assignee_change")
@patch("sentry.integrations.services.jira_forge.impl.handle_issue_moved")
class JiraForgeServiceTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.integration = self.create_integration(
            organization=self.organization, provider="jira", external_id="cloud-id"
        )

    def handle(self) -> None:
        jira_forge_service.handle_issue_updated(
            cell_name=settings.SENTRY_FALLBACK_CELL, integration_id=self.integration.id, event=EVENT
        )

    def test_applies_event(self, moved: MagicMock, assignee: MagicMock, status: MagicMock) -> None:
        order = MagicMock()
        order.attach_mock(moved, "moved")
        order.attach_mock(assignee, "assignee")
        order.attach_mock(status, "status")

        self.handle()

        # The other handlers look the issue up by key, so a move is applied first.
        assert [c[0] for c in order.mock_calls] == ["moved", "assignee", "status"]
        assert moved.call_args.args[0].id == self.integration.id
        assert moved.call_args.args[1] == EVENT

    def test_skips_inactive_integration(
        self, moved: MagicMock, assignee: MagicMock, status: MagicMock
    ) -> None:
        with assume_test_silo_mode(SiloMode.CONTROL):
            self.integration.update(status=ObjectStatus.DISABLED)

        self.handle()

        assert not moved.called and not assignee.called and not status.called

    @patch("sentry.integrations.services.jira_forge.impl.sentry_sdk.capture_exception")
    def test_reports_failures_without_raising(
        self, capture: MagicMock, moved: MagicMock, assignee: MagicMock, status: MagicMock
    ) -> None:
        # A raise would fail the outbox and hold up every later event for this integration.
        assignee.side_effect = Exception("boom")

        self.handle()

        # Only the failed change is dropped; the rest of the event still applies.
        assert capture.call_count == 1
        assert moved.call_count == 1
        assert status.call_count == 1


# The move as Forge sends it, captured from a test site: a project item plus a Key item
# with fromString/toString set and no raw from/to.
FORGE_MOVE_EVENT: dict[str, Any] = {
    "eventType": "avi:jira:updated:issue",
    "jiraEventTypeName": "issue_moved",
    "issue": {
        "id": "10008",
        "key": "T2-1",
        "fields": {
            "assignee": None,
            "project": {"id": "10003", "key": "T2"},
            "status": {"id": "10011", "name": "Selected for development"},
            "updated": "2025-11-10T12:41:22.000-0500",
        },
    },
    "changelog": {
        "id": "10026",
        "items": [
            {
                "field": "project",
                "fieldtype": "jira",
                "fieldId": "project",
                "from": "10002",
                "fromString": "Forge Test",
                "to": "10003",
                "toString": "Test 2",
            },
            {"field": "Key", "fieldtype": "jira", "fromString": "FT-1", "toString": "T2-1"},
        ],
    },
}


@all_silo_test
class JiraForgeServiceForgeEventTest(TestCase):
    def test_forge_move_rekeys_external_issue(self) -> None:
        integration = self.create_integration(
            organization=self.organization, provider="jira", external_id="cloud-id"
        )
        with assume_test_silo_mode(SiloMode.CELL):
            external_issue = self.create_integration_external_issue(
                group=self.create_group(), integration=integration, key="FT-1"
            )

        jira_forge_service.handle_issue_updated(
            cell_name=settings.SENTRY_FALLBACK_CELL,
            integration_id=integration.id,
            event=FORGE_MOVE_EVENT,
        )

        with assume_test_silo_mode(SiloMode.CELL):
            external_issue.refresh_from_db()
        assert external_issue.key == "T2-1"
        assert external_issue.metadata[PROVIDER_ISSUE_ID_KEY] == "10008"
