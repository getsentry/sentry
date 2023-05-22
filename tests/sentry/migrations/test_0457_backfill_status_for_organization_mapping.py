from sentry.models.organization import OrganizationStatus
from sentry.testutils.cases import TestMigrations


class BackfillOrganizationStatusTest(TestMigrations):
    migrate_from = "0456_add_organization_status_to_org_mapping"
    migrate_to = "0457_backfill_status_for_organization_mapping"

    def setup_initial_state(self):
        self.organization = self.create_organization(
            status=OrganizationStatus.ACTIVE, no_mapping=True
        )
        self.org_mapping = self.create_organization_mapping(org=self.organization, status=None)

        # Verify that we have a status mapping of none before testing
        assert self.org_mapping.status is None

        self.unmodified_organization = self.create_organization(
            slug="test_unmodified",
            name="test_unmod",
            status=OrganizationStatus.PENDING_DELETION,
            no_mapping=True,
        )

        self.unmodified_org_mapping = self.create_organization_mapping(
            org=self.unmodified_organization, status=OrganizationStatus.ACTIVE
        )

    def test(self):
        self.org_mapping.refresh_from_db()

        assert self.org_mapping.status is not None
        assert self.org_mapping.status == self.organization.status

        # Validate that an already set, but mismatching organization mapping is not updated (outbox pending)
        self.unmodified_org_mapping.refresh_from_db()
        assert self.org_mapping.status == OrganizationStatus.ACTIVE
