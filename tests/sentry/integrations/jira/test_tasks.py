from typing import Any
from unittest.mock import MagicMock, patch

import pytest
import responses

from sentry.constants import ObjectStatus
from sentry.integrations.jira.client import JiraCloudClient
from sentry.integrations.jira.tasks import apply_forge_issue_event, sync_metadata
from sentry.integrations.models.integration import Integration
from sentry.integrations.utils.external_issue_key import PROVIDER_ISSUE_ID_KEY
from sentry.shared_integrations.exceptions import ApiError
from sentry.silo.base import SiloMode
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import assume_test_silo_mode, cell_silo_test, control_silo_test


@control_silo_test
class SyncMetadataTest(TestCase):
    @responses.activate
    def test_no_sync_with_no_org(self) -> None:
        integration = self.create_integration(
            organization=self.organization,
            provider="jira",
            external_id="abc123",
            metadata={
                "base_url": "https://acme.atlassian.net",
                "shared_secret": "super-sekret",
            },
        )
        org_integration = integration.organizationintegration_set.first()
        if org_integration:
            org_integration.delete()
        sync_metadata(integration.id)
        assert len(responses.calls) == 0

    @responses.activate
    def test_success(self) -> None:
        responses.add(
            responses.GET,
            "https://acme.atlassian.net/rest/api/2/serverInfo",
            json={
                "serverTitle": "Acme Jira",
            },
        )
        responses.add(
            responses.GET,
            "https://acme.atlassian.net/rest/api/2/project",
            json=[
                {"avatarUrls": {"48x48": "https://example.com/avatar.jpg"}},
            ],
        )
        integration = self.create_integration(
            organization=self.organization,
            provider="jira",
            external_id="abc123",
            metadata={
                "base_url": "https://acme.atlassian.net",
                "shared_secret": "super-sekret",
            },
        )
        sync_metadata(integration.id)

        integration.refresh_from_db()
        assert integration.name == "Acme Jira"
        assert integration.metadata["icon"] == "https://example.com/avatar.jpg"

    @responses.activate
    def test_keeps_metadata_written_during_sync(self) -> None:
        responses.add(
            responses.GET,
            "https://acme.atlassian.net/rest/api/2/serverInfo",
            json={"serverTitle": "Acme Jira"},
        )
        integration = self.create_integration(
            organization=self.organization,
            provider="jira",
            external_id="abc123",
            metadata={
                "base_url": "https://acme.atlassian.net",
                "shared_secret": "super-sekret",
            },
        )

        def write_concurrently(client: JiraCloudClient) -> list[dict[str, object]]:
            # Another writer stores a key between this task's read and its write.
            Integration.objects.filter(id=integration.id).update(
                metadata={**integration.metadata, "forge": {"system_token": "token"}}
            )
            return [{"avatarUrls": {"48x48": "https://example.com/avatar.jpg"}}]

        with patch.object(JiraCloudClient, "get_projects_list", write_concurrently):
            sync_metadata(integration.id)

        integration.refresh_from_db()
        assert integration.name == "Acme Jira"
        assert integration.metadata["icon"] == "https://example.com/avatar.jpg"
        assert integration.metadata["forge"] == {"system_token": "token"}


EVENT: dict[str, Any] = {
    "issue": {"id": "10001", "key": "APP-1", "fields": {}},
    "changelog": {"id": "20001", "items": [{"field": "status", "toString": "Done"}]},
}

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


@cell_silo_test
@patch("sentry.integrations.jira.tasks.handle_status_change")
@patch("sentry.integrations.jira.tasks.handle_assignee_change")
@patch("sentry.integrations.jira.tasks.handle_issue_moved")
class ApplyForgeIssueEventTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.integration = self.create_integration(
            organization=self.organization, provider="jira", external_id="cloud-id"
        )

    def test_applies_changes_in_order(
        self, moved: MagicMock, assignee: MagicMock, status: MagicMock
    ) -> None:
        order = MagicMock()
        order.attach_mock(moved, "moved")
        order.attach_mock(assignee, "assignee")
        order.attach_mock(status, "status")

        apply_forge_issue_event(self.integration.id, EVENT)

        # The other handlers look the issue up by key, so a move is applied first.
        assert [c[0] for c in order.mock_calls] == ["moved", "assignee", "status"]
        assert moved.call_args.args[0].id == self.integration.id
        assert moved.call_args.args[1] == EVENT

    def test_skips_inactive_integration(
        self, moved: MagicMock, assignee: MagicMock, status: MagicMock
    ) -> None:
        with assume_test_silo_mode(SiloMode.CONTROL):
            self.integration.update(status=ObjectStatus.DISABLED)

        apply_forge_issue_event(self.integration.id, EVENT)

        assert not moved.called and not assignee.called and not status.called

    @patch("sentry.integrations.jira.tasks.sentry_sdk.capture_exception")
    def test_reports_other_failures_and_applies_the_rest(
        self, capture: MagicMock, moved: MagicMock, assignee: MagicMock, status: MagicMock
    ) -> None:
        assignee.__name__ = "handle_assignee_change"
        assignee.side_effect = KeyError("unexpected payload")

        apply_forge_issue_event(self.integration.id, EVENT)

        assert capture.call_count == 1
        assert status.call_count == 1

    def test_raises_jira_api_errors_for_retry(
        self, moved: MagicMock, assignee: MagicMock, status: MagicMock
    ) -> None:
        assignee.side_effect = ApiError("Jira is down")

        with pytest.raises(ApiError):
            apply_forge_issue_event(self.integration.id, EVENT)


@cell_silo_test
class ApplyForgeIssueEventRealHandlersTest(TestCase):
    def test_forge_move_rekeys_external_issue(self) -> None:
        integration = self.create_integration(
            organization=self.organization, provider="jira", external_id="cloud-id"
        )
        external_issue = self.create_integration_external_issue(
            group=self.create_group(), integration=integration, key="FT-1"
        )

        apply_forge_issue_event(integration.id, FORGE_MOVE_EVENT)
        # Applying the event again, as a retry would, leaves the new key alone.
        apply_forge_issue_event(integration.id, FORGE_MOVE_EVENT)

        external_issue.refresh_from_db()
        assert external_issue.key == "T2-1"
        assert external_issue.metadata[PROVIDER_ISSUE_ID_KEY] == "10008"
