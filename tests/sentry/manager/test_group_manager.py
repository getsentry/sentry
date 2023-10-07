from sentry.models.group import Group
from sentry.models.integrations.integration import Integration
from sentry.services.hybrid_cloud.integration.serial import serialize_integration
from sentry.testutils.cases import TestCase
from sentry.testutils.skips import requires_snuba

pytestmark = requires_snuba


class SentryManagerTest(TestCase):
    def test_valid_only_message(self):
        proj = self.create_project()
        event = Group.objects.from_kwargs(proj.id, message="foo")
        self.assertEqual(event.group.last_seen, event.datetime)
        self.assertEqual(event.message, "foo")
        self.assertEqual(event.project_id, proj.id)

    def test_get_groups_by_external_issue(self):
        external_issue_key = "api-123"
        group = self.create_group()
        integration_model = Integration.objects.create(
            provider="jira",
            external_id="some_id",
            name="Hello world",
            metadata={"base_url": "https://example.com"},
        )
        integration_model.add_organization(group.organization, self.user)
        integration = serialize_integration(integration=integration_model)
        self.create_integration_external_issue(
            group=group, integration=integration, key=external_issue_key
        )

        affected_groups_no_orgs = Group.objects.get_groups_by_external_issue(
            integration,
            [],
            external_issue_key,
        )
        assert set(affected_groups_no_orgs) == set()

        affected_groups_wrong_key = Group.objects.get_groups_by_external_issue(
            integration,
            [group.organization],
            "invalid",
        )
        assert set(affected_groups_wrong_key) == set()

        affected_groups = Group.objects.get_groups_by_external_issue(
            integration,
            [group.organization],
            external_issue_key,
        )
        assert set(affected_groups) == {group}
