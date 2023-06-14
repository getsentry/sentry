from sentry.models.organization import Organization
from sentry.testutils.cases import TestMigrations


class AddIsTestFieldToOrgMigrationTest(TestMigrations):
    migrate_from = "0489_index_checkin_timeout"
    migrate_to = "0490_add_is_test_to_org"

    def test_default(self):
        organization_with_defalult = Organization.objects.create(slug="my-organization")
        assert organization_with_defalult.slug == "my-organization"
        assert organization_with_defalult.is_test is False

    def test_test_org(self):
        test_organization = Organization.objects.create(slug="test-org", is_test=True)
        assert test_organization.is_test is True
