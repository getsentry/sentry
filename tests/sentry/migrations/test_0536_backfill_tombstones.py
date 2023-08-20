from sentry.models import ControlTombstone, RegionTombstone
from sentry.testutils.cases import TestMigrations


class BackfillTombstones(TestMigrations):
    migrate_from = "0535_add_created_date_to_outbox_model"
    migrate_to = "0536_backfill_tombstones"

    def setup_initial_state(self):
        self.tombstones = [
            ControlTombstone.objects.create(table_name="table_a", object_identifier=1),
            ControlTombstone.objects.create(table_name="table_a", object_identifier=2),
            ControlTombstone.objects.create(table_name="table_a", object_identifier=3),
            ControlTombstone.objects.create(table_name="table_b", object_identifier=1),
            ControlTombstone.objects.create(table_name="table_b", object_identifier=4),
            RegionTombstone.objects.create(
                table_name="table_a", object_identifier=1
            ),  # overlapping with the first control tombstone
            RegionTombstone.objects.create(table_name="table_c", object_identifier=1),
            RegionTombstone.objects.create(table_name="table_c", object_identifier=2),
            RegionTombstone.objects.create(table_name="table_c", object_identifier=5),
            RegionTombstone.objects.create(table_name="table_c", object_identifier=6),
            RegionTombstone.objects.create(table_name="table_d", object_identifier=99),
        ]

    def test_duplicated_all_tombstones(self):
        for tombstone in self.tombstones:
            assert ControlTombstone.objects.filter(
                table_name=tombstone.table_name, object_identifier=tombstone.object_identifier
            ).exists()
            assert RegionTombstone.objects.filter(
                table_name=tombstone.table_name, object_identifier=tombstone.object_identifier
            ).exists()
