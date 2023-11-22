from sentry.models.tombstone import ControlTombstone, RegionTombstone
from sentry.silo import SiloMode
from sentry.testutils.cases import TransactionTestCase
from sentry.testutils.outbox import outbox_runner
from sentry.testutils.silo import all_silo_test, assume_test_silo_mode


@all_silo_test
class TombstoneTest(TransactionTestCase):
    def test_writing_control_models(self):
        with assume_test_silo_mode(SiloMode.REGION):
            assert RegionTombstone.objects.count() == 0

        user_id = self.user.id
        self.organization

        with outbox_runner(), assume_test_silo_mode(SiloMode.CONTROL):
            self.user.delete()

        with assume_test_silo_mode(SiloMode.REGION):
            assert RegionTombstone.objects.count() == 1
            assert RegionTombstone.objects.filter(
                table_name="auth_user", object_identifier=user_id
            ).exists()

    def test_writing_region_models(self):
        with assume_test_silo_mode(SiloMode.CONTROL):
            assert ControlTombstone.objects.count() == 0
        org_id = self.organization.id

        with outbox_runner(), assume_test_silo_mode(SiloMode.REGION):
            self.organization.delete()

        with assume_test_silo_mode(SiloMode.CONTROL):
            assert ControlTombstone.objects.count() == 1
            assert ControlTombstone.objects.filter(
                table_name="sentry_organization", object_identifier=org_id
            ).exists()
