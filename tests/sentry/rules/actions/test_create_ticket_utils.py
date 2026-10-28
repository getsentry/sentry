from unittest.mock import MagicMock, patch

from sentry.api.serializers.models.groupactionlogentry import get_serialized_activity_items
from sentry.integrations.mixins.issues import IssueBasicIntegration
from sentry.integrations.services.integration import integration_service
from sentry.issues.action_log import action_context_scope
from sentry.issues.action_log.types import SYSTEM_ACTOR, GroupActionType
from sentry.issues.models.groupactionlogentry import GroupActionLogEntry
from sentry.notifications.types import NotificationActionContext, NotificationOrigin, RuleFuture
from sentry.rules.actions.integrations.create_ticket.utils import (
    build_description,
    create_issue,
    create_link,
)
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.action_log import action_log_activity_enabled


def generate_footer(url: str) -> str:
    return f"\n\nThis issue was created by a workflow: {url}"


class CreateTicketUtilsTest(TestCase):
    @action_log_activity_enabled()
    def test_alert_created_issue_has_one_feed_item(self) -> None:
        integration = self.create_integration(
            organization=self.organization,
            provider="example",
            name="Example",
            external_id="example:1",
        )
        rpc_integration = integration_service.get_integration(integration_id=integration.id)
        assert rpc_integration is not None
        installation = rpc_integration.get_installation(self.organization.id)
        event = self.event.for_group(self.event.group)

        with action_context_scope(source="system", actor=SYSTEM_ACTOR):
            create_link(rpc_integration, installation, event, {"key": "APP-123"})

        items = get_serialized_activity_items(event.group, self.user, endpoint="test")
        assert items is not None
        assert [item["type"] for item in items] == ["create_issue", "first_seen"]
        assert items[0]["data"]["new"] is True
        assert items[0]["data"]["location"] == "https://example/issues/APP-123"
        assert set(
            GroupActionLogEntry.objects.filter(group_id=event.group.id).values_list(
                "type", flat=True
            )
        ) == {
            GroupActionType.FIRST_SEEN,
            GroupActionType.CREATE_ISSUE,
            GroupActionType.CREATE_EXTERNAL_ISSUE,
        }

    def test_build_description(self) -> None:
        installation = MagicMock()
        installation.get_group_description.return_value = "Test description"
        workflow_id = 123

        description = build_description(self.event, workflow_id, installation, generate_footer)

        expected_url = f"/organizations/{self.organization.slug}/monitors/alerts/{workflow_id}/"
        assert (
            description
            == f"Test description\n\nThis issue was created by a workflow: {expected_url}"
        )


class CreateIssueDescriptionTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.integration = self.create_integration(
            organization=self.organization, provider="github", external_id="123"
        )
        self.installation = MagicMock(spec=IssueBasicIntegration)
        self.installation.get_group_title.return_value = "Test title"
        self.installation.get_group_description.return_value = "Test description"

    def _create_issue(self, origin: NotificationOrigin) -> dict:
        data: dict = {}
        future = RuleFuture(
            context=NotificationActionContext(origin=origin, action_id=1, project=self.project),
            kwargs={
                "data": data,
                "provider": "github",
                "integration_id": self.integration.id,
                "generate_footer": generate_footer,
            },
        )
        with (
            patch(
                "sentry.integrations.services.integration.model.RpcIntegration.get_installation",
                return_value=self.installation,
            ),
            patch("sentry.rules.actions.integrations.create_ticket.utils.create_link"),
        ):
            create_issue(self.event.for_group(self.event.group), [future])
        return data

    def test_uses_workflow_url(self) -> None:
        origin = NotificationOrigin(
            label="workflow", environment_id=None, workflow_id=456, legacy_rule_id=789
        )

        with patch("sentry.rules.actions.integrations.create_ticket.utils.logger") as mock_logger:
            data = self._create_issue(origin)

        expected_url = f"/organizations/{self.organization.slug}/monitors/alerts/456/"
        assert (
            data["description"]
            == f"Test description\n\nThis issue was created by a workflow: {expected_url}"
        )
        mock_logger.warning.assert_not_called()

    def test_missing_workflow_id_logs_warning(self) -> None:
        origin = NotificationOrigin(
            label="legacy rule", environment_id=None, workflow_id=None, legacy_rule_id=789
        )

        with patch("sentry.rules.actions.integrations.create_ticket.utils.logger") as mock_logger:
            data = self._create_issue(origin)

        assert data["description"] == "Test description"
        mock_logger.warning.assert_called_once_with(
            "%s.rule_trigger.missing_workflow_id",
            "github",
            extra={
                "legacy_rule_id": 789,
                "project_id": self.project.id,
                "group_id": self.event.group.id,
                "organization_id": self.organization.id,
            },
        )
