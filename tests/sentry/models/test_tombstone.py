from sentry.models.savedsearch import SavedSearch
from sentry.models.tombstone import RegionTombstone
from sentry.models.user import User
from sentry.silo import SiloMode
from sentry.tasks.deletion.hybrid_cloud import schedule_hybrid_cloud_foreign_key_jobs
from sentry.testutils.cases import TestCase
from sentry.testutils.outbox import outbox_runner
from sentry.testutils.silo import assume_test_silo_mode, control_silo_test
from sentry.types.region import Region, RegionCategory

_TEST_REGIONS = (
    Region("na", 1, "http://eu.testserver", RegionCategory.MULTI_TENANT),
    Region("eu", 2, "http://na.testserver", RegionCategory.MULTI_TENANT),
)


@control_silo_test(stable=True, regions=_TEST_REGIONS)
class HybridCloudDeletionTest(TestCase):
    def setUp(self):
        super().setUp()
        self.user = self.create_user()
        self.user_id = self.user.id

        # Organization membership determines which regions the deletion will cascade to
        self.organization = self.create_organization(region=_TEST_REGIONS[0])
        self.create_member(user=self.user, organization=self.organization)

        self.create_saved_search(
            name="some-search", owner=self.user, organization=self.organization
        )

    @assume_test_silo_mode(SiloMode.REGION)
    def user_tombstone_exists(self) -> bool:
        return RegionTombstone.objects.filter(
            table_name="auth_user", object_identifier=self.user_id
        ).exists()

    @assume_test_silo_mode(SiloMode.REGION)
    def get_user_saved_search_count(self) -> int:
        return SavedSearch.objects.filter(owner_id=self.user_id).count()

    def test_simple(self):
        assert not self.user_tombstone_exists()
        with outbox_runner():
            self.user.delete()
        assert not User.objects.filter(id=self.user_id).exists()
        assert self.user_tombstone_exists()

        # cascade is asynchronous, ensure there is still related search,
        assert self.get_user_saved_search_count() == 1

        with assume_test_silo_mode(SiloMode.REGION), self.tasks():
            schedule_hybrid_cloud_foreign_key_jobs()

        # Ensure they are all now gone.
        assert self.get_user_saved_search_count() == 0

    def test_unrelated_saved_search_is_not_deleted(self):
        another_user = self.create_user()
        self.create_member(user=another_user, organization=self.organization)
        self.create_saved_search(
            name="another-search", owner=another_user, organization=self.organization
        )

        with outbox_runner():
            self.user.delete()
        with assume_test_silo_mode(SiloMode.REGION), self.tasks():
            schedule_hybrid_cloud_foreign_key_jobs()

        with assume_test_silo_mode(SiloMode.REGION):
            assert SavedSearch.objects.filter(owner_id=another_user.id).exists()

    def test_cascades_to_multiple_regions(self):
        eu_org = self.create_organization(region=_TEST_REGIONS[1])
        self.create_member(user=self.user, organization=eu_org)
        self.create_saved_search(name="eu-search", owner=self.user, organization=eu_org)

        with outbox_runner():
            self.user.delete()

        assert self.get_user_saved_search_count() == 2
        with assume_test_silo_mode(SiloMode.REGION), self.tasks():
            schedule_hybrid_cloud_foreign_key_jobs()
        assert self.get_user_saved_search_count() == 0
