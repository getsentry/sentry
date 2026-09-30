from unittest.mock import patch

from sentry.integrations.services.integration.impl import DatabaseBackedIntegrationService
from sentry.integrations.services.integration.serial import serialize_integration
from sentry.models.group import Group
from sentry.testutils.cases import TestCase
from sentry.testutils.skips import requires_snuba

pytestmark = requires_snuba


class SentryManagerTest(TestCase):
    def test_get_groups_by_external_issue(self) -> None:
        external_issue_key = "api-123"
        group = self.create_group()
        integration_model, _ = self.create_provider_integration_for(
            group.organization,
            self.user,
            provider="jira",
            external_id="some_id",
            name="Hello world",
            metadata={"base_url": "https://example.com"},
        )
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

    def test_get_groups_by_external_issue_reads_only_the_given_organizations(self) -> None:
        # Loading every organization's install of a widely shared integration is expensive.
        external_issue_key = "api-123"
        group = self.create_group()
        integration_model, _ = self.create_provider_integration_for(
            group.organization,
            self.user,
            provider="jira",
            external_id="some_id",
            name="Hello world",
            metadata={"base_url": "https://example.com"},
        )
        integration = serialize_integration(integration=integration_model)
        self.create_integration_external_issue(
            group=group, integration=integration, key=external_issue_key
        )
        other_org = self.create_organization(owner=self.user)
        self.create_organization_integration(
            organization_id=other_org.id, integration=integration_model
        )
        other_group = self.create_group(project=self.create_project(organization=other_org))
        self.create_integration_external_issue(
            group=other_group, integration=integration, key=external_issue_key
        )

        with patch.object(
            DatabaseBackedIntegrationService,
            "get_organization_integrations",
            autospec=True,
            side_effect=DatabaseBackedIntegrationService.get_organization_integrations,
        ) as get_organization_integrations:
            affected_groups = Group.objects.get_groups_by_external_issue(
                integration,
                [group.organization],
                external_issue_key,
            )

            assert set(affected_groups) == {group}
        assert [
            call.kwargs.get("organization_ids")
            for call in get_organization_integrations.call_args_list
        ] == [[group.organization.id]]
