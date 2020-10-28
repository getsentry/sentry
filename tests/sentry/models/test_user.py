from __future__ import absolute_import

from sentry.models import Authenticator, OrganizationMember, User, UserEmail
from sentry.testutils import TestCase


class UserDetailsTest(TestCase):
    def test_salutation(self):
        user = self.create_user(email="a@example.com", username="a@example.com")
        assert user.get_salutation_name() == "A"

        user.update(name="hello world", email="b@example.com")
        user = User.objects.get(id=user.id)
        assert user.name == "hello world"
        assert user.email == "b@example.com"
        assert user.get_salutation_name() == "Hello"


class UserMergeToTest(TestCase):
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

        from_user.merge_to(to_user)

        member = OrganizationMember.objects.get(user=to_user)

        assert member.role == "owner"
        assert list(member.teams.all().order_by("pk")) == [team_1, team_2, team_3]


class GetUsersFromTeamsTest(TestCase):
    def test(self):
        user = self.create_user()
        org = self.create_organization(name="foo", owner=user)
        team = self.create_team(organization=org)
        org2 = self.create_organization(name="bar", owner=None)
        team2 = self.create_team(organization=org2)
        user2 = self.create_user("foo@example.com")
        self.create_member(user=user2, organization=org, role="admin", teams=[team])

        assert list(User.objects.get_from_teams(org, [team])) == [user2]
        user3 = self.create_user("bar@example.com")
        self.create_member(user=user3, organization=org, role="admin", teams=[team])
        assert set(list(User.objects.get_from_teams(org, [team]))) == set([user2, user3])
        assert list(User.objects.get_from_teams(org2, [team])) == []
        assert list(User.objects.get_from_teams(org2, [team2])) == []
        self.create_member(user=user, organization=org2, role="member", teams=[team2])
        assert list(User.objects.get_from_teams(org2, [team2])) == [user]


class GetUsersFromProjectsTest(TestCase):
    def test(self):
        user = self.create_user()
        org = self.create_organization(name="foo", owner=user)
        team = self.create_team(organization=org)
        project = self.create_project(organization=org, teams=[team])
        org2 = self.create_organization(name="bar", owner=None)
        team2 = self.create_team(organization=org2)
        user2 = self.create_user("foo@example.com")
        project2 = self.create_project(organization=org2, teams=[team2])
        self.create_member(user=user2, organization=org, role="admin", teams=[team])

        assert list(User.objects.get_from_projects(org, [project])) == [user2]
        user3 = self.create_user("bar@example.com")
        self.create_member(user=user3, organization=org, role="admin", teams=[team])
        assert set(list(User.objects.get_from_projects(org, [project]))) == set([user2, user3])
        assert list(User.objects.get_from_projects(org2, [project])) == []
        assert list(User.objects.get_from_projects(org2, [project2])) == []
        self.create_member(user=user, organization=org2, role="member", teams=[team2])
        assert list(User.objects.get_from_projects(org2, [project2])) == [user]
