import pytest

from sentry.models import Organization, OrganizationMapping
from sentry.testutils.cases import TestMigrations


@pytest.mark.skip("Test setup no longer valid after adding is_test to organization model")
class BackfillNotificationSettingTest(TestMigrations):
    migrate_from = "0471_dashboard_widget_description"
    migrate_to = "0472_delete_past_organization_mappings"

    def setup_initial_state(self):
        self.create_organization(name="foo")
        self.create_organization(name="bar")

        # The test fixture itself will create a single organization, does not create mappings
        organizations = Organization.objects.filter()
        assert len(organizations) == 3

        organizations_mappings = OrganizationMapping.objects.filter()
        assert len(organizations_mappings) == 2

    def test_deleting_all_org_mappings(self):
        organization_mappings = OrganizationMapping.objects.filter()
        assert len(organization_mappings) == 0

        organizations = Organization.objects.filter()
        assert len(organizations) == 3
