import pytest

from sentry.models.organization import OrganizationStatus
from sentry.models.organizationmapping import OrganizationMapping
from sentry.testutils.cases import TestMigrations
from sentry.testutils.outbox import outbox_runner


@pytest.mark.skip("Test setup no longer valid after adding is_test to organization model")
class BackfillOrganizationMappingsViaOutboxTest(TestMigrations):
    migrate_from = "0477_control_avatars"
    migrate_to = "0478_backfill_organization_mappings_via_outbox"

    def setup_initial_state(self):
        self.org_without_mapping = self.create_organization(name="foo", slug="foo-slug")
        self.org_with_existing_mapping = self.create_organization(name="bar", slug="bar-slug")
        self.org_with_mismatching_mapping = self.create_organization(
            name="foobar", slug="foobar-slug"
        )

        # Delete the org mapping for one of the organizations
        OrganizationMapping.objects.get(organization_id=self.org_without_mapping.id).delete()

        self.org_deletion_in_progress = self.create_organization(
            name="deleteme", slug="noimportante", status=OrganizationStatus.DELETION_IN_PROGRESS
        )
        # Clear the org mapping for the org pending deletion
        OrganizationMapping.objects.get(organization_id=self.org_deletion_in_progress.id).delete()

        mismatch_mapping = OrganizationMapping.objects.get(
            organization_id=self.org_with_mismatching_mapping.id
        )
        mismatch_mapping.name = "old_name"
        mismatch_mapping.slug = "old-slug"
        mismatch_mapping.save()

    def test_backfill_of_org_mappings(self):
        with outbox_runner():
            pass

        newly_created_org_mapping = OrganizationMapping.objects.get(
            organization_id=self.org_without_mapping.id
        )
        assert newly_created_org_mapping.slug == self.org_without_mapping.slug
        assert newly_created_org_mapping.name == self.org_without_mapping.name
        assert newly_created_org_mapping.customer_id == self.org_without_mapping.customer_id
        assert newly_created_org_mapping.status == self.org_without_mapping.status

        updated_org_mapping = OrganizationMapping.objects.get(
            organization_id=self.org_with_mismatching_mapping.id
        )
        assert updated_org_mapping.slug == self.org_with_mismatching_mapping.slug
        assert updated_org_mapping.name == self.org_with_mismatching_mapping.name
        assert updated_org_mapping.customer_id == self.org_with_mismatching_mapping.customer_id
        assert updated_org_mapping.status == self.org_with_mismatching_mapping.status

        untouched_org_mapping = OrganizationMapping.objects.get(
            organization_id=self.org_with_existing_mapping.id
        )
        assert untouched_org_mapping.slug == self.org_with_existing_mapping.slug
        assert untouched_org_mapping.name == self.org_with_existing_mapping.name
        assert untouched_org_mapping.customer_id == self.org_with_existing_mapping.customer_id
        assert untouched_org_mapping.status == self.org_with_existing_mapping.status

        with pytest.raises(OrganizationMapping.DoesNotExist):
            OrganizationMapping.objects.get(organization_id=self.org_deletion_in_progress.id)
