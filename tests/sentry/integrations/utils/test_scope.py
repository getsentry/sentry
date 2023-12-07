from unittest.mock import MagicMock, patch

from sentry.integrations.utils.scope import bind_org_context_from_integration, get_org_integrations
from sentry.models.integrations.integration import Integration
from sentry.models.integrations.organization_integration import OrganizationIntegration
from sentry.services.hybrid_cloud.integration.serial import serialize_organization_integration
from sentry.services.hybrid_cloud.organization.serial import serialize_rpc_organization
from sentry.silo.base import SiloMode
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import all_silo_test, assume_test_silo_mode


@all_silo_test
class GetOrgsFromIntegrationTest(TestCase):
    def test_finds_single_org(self):
        org = self.create_organization(slug="dogsaregreat")
        with assume_test_silo_mode(SiloMode.CONTROL):
            integration = Integration.objects.create(name="squirrelChasers")
            integration.add_organization(org)

        actual = get_org_integrations(integration.id)

        with assume_test_silo_mode(SiloMode.CONTROL):
            ois = OrganizationIntegration.objects.filter(
                organization_id=org.id, integration_id=integration.id
            ).all()

        assert actual == [serialize_organization_integration(oi) for oi in ois]

    def test_finds_multiple_orgs(self):
        maisey_org = self.create_organization(slug="themaiseymaiseydog")
        charlie_org = self.create_organization(slug="charliebear")
        with assume_test_silo_mode(SiloMode.CONTROL):
            integration = Integration.objects.create(name="squirrelChasers")
            integration.add_organization(maisey_org)
            integration.add_organization(charlie_org)

        actual = get_org_integrations(integration.id)

        with assume_test_silo_mode(SiloMode.CONTROL):
            ois = OrganizationIntegration.objects.filter(integration_id=integration.id).all()
        expected = [serialize_organization_integration(oi) for oi in ois]
        assert actual == expected

    def test_finds_no_orgs_without_erroring(self):
        with assume_test_silo_mode(SiloMode.CONTROL):
            integration = Integration.objects.create(name="squirrelChasers")

        actual = get_org_integrations(integration.id)

        assert actual == []


@all_silo_test
class BindOrgContextFromIntegrationTest(TestCase):
    @patch("sentry.integrations.utils.scope.bind_organization_context")
    def test_binds_org_context_with_single_org(self, mock_bind_org_context: MagicMock):
        org = self.create_organization(slug="dogsaregreat")
        with assume_test_silo_mode(SiloMode.CONTROL):
            integration = Integration.objects.create(name="squirrelChasers")
            integration.add_organization(org)

        bind_org_context_from_integration(integration.id)

        with assume_test_silo_mode(SiloMode.REGION):
            mock_bind_org_context.assert_called_with(serialize_rpc_organization(org))

    @patch("sentry.integrations.utils.scope.bind_ambiguous_org_context")
    def test_binds_org_context_with_multiple_orgs(self, mock_bind_ambiguous_org_context: MagicMock):
        maisey_org = self.create_organization(slug="themaiseymaiseydog")
        charlie_org = self.create_organization(slug="charliebear")
        with assume_test_silo_mode(SiloMode.CONTROL):
            integration = Integration.objects.create(name="squirrelChasers")
            integration.add_organization(maisey_org)
            integration.add_organization(charlie_org)

        bind_org_context_from_integration(integration.id)

        mock_bind_ambiguous_org_context.assert_called_with(
            [maisey_org.slug, charlie_org.slug], f"integration (id={integration.id})"
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
        with assume_test_silo_mode(SiloMode.CONTROL):
            integration = Integration.objects.create(name="squirrelChasers")

        bind_org_context_from_integration(integration.id, {"webhook": "issue_updated"})
        mock_logger_warning.assert_called_with(
            "Can't bind org context - no orgs are associated with integration id=%s.",
            integration.id,
            extra={"webhook": "issue_updated"},
        )
        mock_check_tag_for_scope_bleed.assert_called_with(
            "integration_id", integration.id, add_to_scope=False
        )
        mock_bind_org_context.assert_not_called()
        mock_bind_ambiguous_org_context.assert_not_called()
