import pytest
from django.db import IntegrityError

from sentry.models.organization import Organization
from sentry.models.organizationmapping import OrganizationMapping
from sentry.testutils.cases import TestMigrations


@pytest.mark.skip("Test setup no longer valid after adding is_test to organization model")
class MakeOrganizationMappingOrgIdUnique(TestMigrations):
    migrate_from = "0473_backfill_organization_member_is_active"
    migrate_to = "0474_make_organization_mapping_org_id_unique"

    def setup_initial_state(self):
        self.foo_org = self.create_organization(name="foo")
        self.bar_org = self.create_organization(name="bar")

        # The test fixture itself will create a single organization, does not create mappings
        organizations = Organization.objects.filter()
        assert len(organizations) == 3

        organizations_mappings = OrganizationMapping.objects.filter()
        assert len(organizations_mappings) == 2

    def test_inserting_duplicate_org(self):
        organization_mappings = OrganizationMapping.objects.filter()
        assert len(organization_mappings) == 2

        organizations = Organization.objects.filter()
        assert len(organizations) == 3
        self.foo_org.slug = "newslug"

        with pytest.raises(IntegrityError):
            self.create_organization_mapping(org=self.foo_org)
