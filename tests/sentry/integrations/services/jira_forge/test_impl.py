from typing import Any
from unittest.mock import MagicMock, patch

from sentry.constants import ObjectStatus
from sentry.integrations.services.jira_forge import jira_forge_service
from sentry.silo.base import SiloMode
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import assume_test_silo_mode, cell_silo_test
from sentry.types.cell import get_local_cell

EVENT: dict[str, Any] = {
    "issue": {"id": "10001", "key": "APP-1", "fields": {}},
    "changelog": {"id": "20001", "items": [{"field": "status", "toString": "Done"}]},
}


@cell_silo_test
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
            cell_name=get_local_cell().name, integration_id=self.integration.id, event=EVENT
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

        assert capture.call_count == 1
        assert not status.called
        assert moved.call_count == 1
