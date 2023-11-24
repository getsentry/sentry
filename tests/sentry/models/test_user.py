from sentry.models.authenticator import Authenticator
from sentry.models.organizationmember import OrganizationMember
from sentry.models.savedsearch import SavedSearch
from sentry.models.tombstone import RegionTombstone
from sentry.models.user import User
from sentry.models.useremail import UserEmail
from sentry.silo import SiloMode
from sentry.tasks.deletion.hybrid_cloud import schedule_hybrid_cloud_foreign_key_jobs
from sentry.testutils.cases import TestCase
from sentry.testutils.hybrid_cloud import HybridCloudTestMixin
from sentry.testutils.outbox import outbox_runner
from sentry.testutils.silo import assume_test_silo_mode, control_silo_test
from sentry.types.region import Region, RegionCategory

_TEST_REGIONS = (
    Region("na", 1, "http://eu.testserver", RegionCategory.MULTI_TENANT),
    Region("eu", 2, "http://na.testserver", RegionCategory.MULTI_TENANT),
)


@control_silo_test(regions=_TEST_REGIONS)
class UserHybridCloudDeletionTest(TestCase):
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


@control_silo_test
class UserDetailsTest(TestCase):
    def test_get_full_name(self):
        user = self.create_user(name="foo bar")
        assert user.name == user.get_full_name() == "foo bar"

    def test_salutation(self):
        user = self.create_user(email="a@example.com", username="a@example.com")
        assert user.get_salutation_name() == "A"

        user.update(name="hello world", email="b@example.com")
        user = User.objects.get(id=user.id)
        assert user.name == "hello world"
        assert user.email == "b@example.com"
        assert user.get_salutation_name() == "Hello"


@control_silo_test
class UserMergeToTest(TestCase, HybridCloudTestMixin):
    def test_simple(self):
        from_user = self.create_user("foo@example.com")
        UserEmail.objects.create_or_update(
            user=from_user, email=from_user.email, values={"is_verified": True}
        )
        to_user = self.create_user("bar@example.com")
        UserEmail.objects.create_or_update(
            user=to_user, email=to_user.email, values={"is_verified": True}
        )
        auth1 = Authenticator.objects.create(user=from_user, type=1)
        auth2 = Authenticator.objects.create(user=to_user, type=1)
        auth3 = Authenticator.objects.create(user=to_user, type=2)

        from_user.merge_to(to_user)

        with assume_test_silo_mode(SiloMode.REGION):
            assert not OrganizationMember.objects.filter(user_id=from_user.id).exists()
            for member in OrganizationMember.objects.filter(user_id=to_user.id):
                self.assert_org_member_mapping(org_member=member)

        assert UserEmail.objects.filter(
            user=to_user, email=to_user.email, is_verified=True
        ).exists()

        assert UserEmail.objects.filter(
            user=to_user, email=from_user.email, is_verified=True
        ).exists()

        assert Authenticator.objects.filter(user=to_user, id=auth2.id).exists()
        assert Authenticator.objects.filter(user=to_user, id=auth3.id).exists()
        # dupe shouldn't get merged
        assert Authenticator.objects.filter(user=from_user, id=auth1.id).exists()

    def test_duplicate_memberships(self):
        from_user = self.create_user("foo@example.com")
        to_user = self.create_user("bar@example.com")

        org_1 = self.create_organization()
        team_1 = self.create_team(organization=org_1)
        team_2 = self.create_team(organization=org_1)
        team_3 = self.create_team(organization=org_1)
        self.create_member(organization=org_1, user=from_user, role="owner", teams=[team_1, team_2])
        # to_user should have less roles
        self.create_member(organization=org_1, user=to_user, role="member", teams=[team_2, team_3])

        with outbox_runner():
            from_user.merge_to(to_user)

        with assume_test_silo_mode(SiloMode.REGION):
            for member in OrganizationMember.objects.filter(user_id__in=[from_user.id, to_user.id]):
                self.assert_org_member_mapping(org_member=member)
            member = OrganizationMember.objects.get(user_id=to_user.id)

        assert member.role == "owner"
        assert list(member.teams.all().order_by("pk")) == [team_1, team_2, team_3]
