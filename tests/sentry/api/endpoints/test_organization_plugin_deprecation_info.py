from typing import int
from django.urls import reverse

from sentry.models.groupmeta import GroupMeta
from sentry.models.options.project_option import ProjectOption
from sentry.testutils.cases import APITestCase


class OrganizationPluginDeprecationInfoEndpointTest(APITestCase):
    endpoint = "sentry-api-0-organization-plugin-deprecation-info"

    def setUp(self) -> None:
        super().setUp()
        self.login_as(user=self.user)
        self.plugin_name = "test-plugin"

        self.organization = self.create_organization(owner=self.user)
        self.project_with_plugin = self.create_project(
            organization=self.organization, name="Project With Plugin"
        )
        ProjectOption.objects.set_value(
            self.project_with_plugin, f"{self.plugin_name}:enabled", True
        )

        self.project_without_plugin = self.create_project(
            organization=self.organization, name="Project Without Plugin"
        )

    def reverse_url(self, organization_slug=None):
        return reverse(
            self.endpoint,
            kwargs={
                "organization_id_or_slug": organization_slug or self.organization.slug,
                "plugin_slug": "Test-Plugin",
            },
        )

    def test_project_with_linked_issue(self):
        group_with_plugin = self.create_group(project=self.project_with_plugin)
        group_without_plugin = self.create_group(project=self.project_without_plugin)

        GroupMeta.objects.create(
            group=group_with_plugin, key=f"{self.plugin_name}:tid", value="ticket-123"
        )
        GroupMeta.objects.create(
            group=group_without_plugin, key=f"{self.plugin_name}:tid", value="ticket-456"
        )

        url = self.reverse_url()
        response = self.client.get(url)

        assert response.status_code == 200
        assert response.data["affected_rules"] == []

        # Should only return the group from the enabled project
        affected_groups = response.data["affected_groups"]
        assert len(affected_groups) == 1
        assert f"/issues/{group_with_plugin.id}/" in affected_groups[0]

    def test_project_with_plugin_rule(self):
        rule_action_data = [
            {
                "id": "sentry.rules.actions.notify_event_service.NotifyEventServiceAction",
                "service": self.plugin_name,
                "name": f"Send a notification via {self.plugin_name}",
            }
        ]

        rule = self.create_project_rule(
            project=self.project_with_plugin,
            action_data=rule_action_data,
            name="Test Plugin Alert Rule",
        )

        url = self.reverse_url()
        response = self.client.get(url)

        assert response.status_code == 200

        # Should return the rule URL in affected_rules
        affected_rules = response.data["affected_rules"]
        assert len(affected_rules) == 1
        expected_rule_url = f"/organizations/{self.organization.slug}/alerts/rules/{self.project_with_plugin.slug}/{rule.id}/details/"
        assert expected_rule_url in affected_rules[0]

    def test_permission_denied_for_non_member(self):
        non_member_user = self.create_user("non-member@example.com")
        self.login_as(non_member_user)

        url = self.reverse_url()
        response = self.client.get(url)

        assert response.status_code == 403
