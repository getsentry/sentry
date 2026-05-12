from datetime import datetime, timezone

from django.db import router

from sentry.models.organization import Organization
from sentry.models.organizationmapping import OrganizationMapping
from sentry.silo.base import SiloMode
from sentry.silo.safety import unguarded_write
from sentry.testutils.cases import TestMigrations
from sentry.testutils.outbox import outbox_runner
from sentry.testutils.silo import assume_test_silo_mode


class BackfillOrganizationMappingDateCreatedTest(TestMigrations):
    migrate_from = "1088_remove_rulefirehistory"
    migrate_to = "1089_backfill_organization_mapping_date_created"

    def setup_before_migration(self, apps):
        # Set Organization.date_added and OrganizationMapping.date_created to
        # different deterministic values to simulate the pre-#115325 state
        # where the mapping column held a fresh timezone.now() rather than
        # Organization.date_added. The migration's emitted outboxes drain
        # through the replication receiver and overwrite date_created with
        # the org's true date_added.
        self.real_date_added = datetime(2020, 6, 1, 12, 0, tzinfo=timezone.utc)
        poisoned_date_created = datetime(2025, 1, 1, tzinfo=timezone.utc)

        with assume_test_silo_mode(SiloMode.MONOLITH):
            self.org = self.create_organization()

            with unguarded_write(using=router.db_for_write(Organization)):
                Organization.objects.filter(id=self.org.id).update(date_added=self.real_date_added)

            with unguarded_write(using=router.db_for_write(OrganizationMapping)):
                OrganizationMapping.objects.filter(organization_id=self.org.id).update(
                    date_created=poisoned_date_created
                )

    def test(self) -> None:
        with assume_test_silo_mode(SiloMode.CONTROL):
            mapping = OrganizationMapping.objects.get(organization_id=self.org.id)

        assert mapping.date_created != self.real_date_added

        # The migration only emits cell outboxes; the receiver drains each
        # one and re-runs Organization.handle_async_replication, which now
        # plumbs date_added → date_created.
        with outbox_runner():
            pass

        with assume_test_silo_mode(SiloMode.CONTROL):
            mapping = OrganizationMapping.objects.get(organization_id=self.org.id)

        assert mapping.date_created == self.real_date_added
