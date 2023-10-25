from sentry.models.authenticator import Authenticator
from sentry.models.organizationmember import OrganizationMember
from sentry.models.savedsearch import SavedSearch
from sentry.models.user import User
from sentry.models.useremail import UserEmail
from sentry.silo import SiloMode
from sentry.tasks.deletion.hybrid_cloud import schedule_hybrid_cloud_foreign_key_jobs
from sentry.testutils.cases import TestCase
from sentry.testutils.hybrid_cloud import HybridCloudTestMixin
from sentry.testutils.outbox import outbox_runner
from sentry.testutils.silo import assume_test_silo_mode, control_silo_test


@control_silo_test
class UserTest(TestCase):
    def test_hybrid_cloud_deletion(self):
        user = self.create_user()
        user_id = user.id
        self.create_saved_search(name="some-search", owner=user)

        with outbox_runner():
            user.delete()

        assert not User.objects.filter(id=user_id).exists()

        with assume_test_silo_mode(SiloMode.REGION):
            # cascade is asynchronous, ensure there is still related search,
            assert SavedSearch.objects.filter(owner_id=user_id).exists()
            with self.tasks():
                schedule_hybrid_cloud_foreign_key_jobs()

            # Ensure they are all now gone.
            assert not SavedSearch.objects.filter(owner_id=user_id).exists()


@control_silo_test(stable=True)
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


@control_silo_test(stable=True)
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
