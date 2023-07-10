from unittest.mock import MagicMock, patch

from sentry.integrations.utils.scope import (
    bind_org_context_from_integration,
    get_orgs_from_integration,
)
from sentry.models.integrations.integration import Integration
from sentry.testutils import TestCase


class GetOrgsFromIntegrationTest(TestCase):
    def test_finds_single_org(self):
        org = self.create_organization(slug="dogsaregreat")
        integration = Integration.objects.create(name="squirrelChasers")
        integration.add_organization(org)

        found_orgs = get_orgs_from_integration(integration.id)

        assert found_orgs == [org]

    def test_finds_multiple_orgs(self):
        maisey_org = self.create_organization(slug="themaiseymaiseydog")
        charlie_org = self.create_organization(slug="charliebear")
        integration = Integration.objects.create(name="squirrelChasers")
        integration.add_organization(maisey_org)
        integration.add_organization(charlie_org)

        found_orgs = get_orgs_from_integration(integration.id)

        assert found_orgs == [maisey_org, charlie_org]

    def test_finds_no_orgs_without_erroring(self):
        integration = Integration.objects.create(name="squirrelChasers")

        found_orgs = get_orgs_from_integration(integration.id)

        assert found_orgs == []


class BindOrgContextFromIntegrationTest(TestCase):
    @patch("sentry.integrations.utils.scope.bind_organization_context")
    def test_binds_org_context_with_single_org(self, mock_bind_org_context: MagicMock):
        org = self.create_organization(slug="dogsaregreat")
        integration = Integration.objects.create(name="squirrelChasers")
        integration.add_organization(org)

        bind_org_context_from_integration(integration.id)

        mock_bind_org_context.assert_called_with(org)

    @patch("sentry.integrations.utils.scope.bind_ambiguous_org_context")
    def test_binds_org_context_with_multiple_orgs(self, mock_bind_ambiguous_org_context: MagicMock):
        maisey_org = self.create_organization(slug="themaiseymaiseydog")
        charlie_org = self.create_organization(slug="charliebear")
        integration = Integration.objects.create(name="squirrelChasers")
        integration.add_organization(maisey_org)
        integration.add_organization(charlie_org)

        bind_org_context_from_integration(integration.id)

        mock_bind_ambiguous_org_context.assert_called_with(
            [maisey_org, charlie_org], f"integration (id={integration.id})"
        )

    @patch("sentry.integrations.utils.scope.bind_ambiguous_org_context")
    @patch("sentry.integrations.utils.scope.bind_organization_context")
    @patch("sentry.integrations.utils.scope.check_tag_for_scope_bleed")
    @patch("sentry.integrations.utils.scope.logger.warning")
    def test_logs_warning_if_no_orgs_found(
        self,
        mock_logger_warning: MagicMock,
        mock_check_tag_for_scope_bleed: MagicMock,
        mock_bind_org_context: MagicMock,
        mock_bind_ambiguous_org_context: MagicMock,
    ):
        integration = Integration.objects.create(name="squirrelChasers")

        bind_org_context_from_integration(integration.id, {"webhook": "issue_updated"})
        mock_logger_warning.assert_called_with(
            f"Can't bind org context - no orgs are associated with integration id={integration.id}.",
            extra={"webhook": "issue_updated"},
        )
        mock_check_tag_for_scope_bleed.assert_called_with(
            "integration_id", integration.id, add_to_scope=False
        )
        mock_bind_org_context.assert_not_called()
        mock_bind_ambiguous_org_context.assert_not_called()
