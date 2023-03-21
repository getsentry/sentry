from sentry.models import Team, User
from sentry.services.hybrid_cloud.user import user_service
from sentry.testutils import TestCase
from sentry.testutils.silo import region_silo_test


@region_silo_test
class TeamManagerTest(TestCase):
    def test_simple(self):
        user = User.objects.create(username="foo")
        org = self.create_organization()
        team = self.create_team(organization=org, name="Test")
        self.create_member(organization=org, user=user, teams=[team])

        result = Team.objects.get_for_user(organization=org, user=user)
        assert result == [team]

    def test_simple_with_rpc_user(self):
        user = user_service.get_user(User.objects.create(username="foo").id)
        org = self.create_organization()
        team = self.create_team(organization=org, name="Test")
        self.create_member(organization=org, user_id=user.id, teams=[team])

        result = Team.objects.get_for_user(organization=org, user=user)
        assert result == [team]

    def test_invalid_scope(self):
        user = User.objects.create(username="foo")
        org = self.create_organization()
        team = self.create_team(organization=org, name="Test")
        self.create_member(organization=org, user=user, teams=[team])
        result = Team.objects.get_for_user(organization=org, user=user, scope="idontexist")
        assert result == []

    def test_valid_scope(self):
        user = User.objects.create(username="foo")
        org = self.create_organization()
        team = self.create_team(organization=org, name="Test")
        self.create_member(organization=org, user=user, teams=[team])
        result = Team.objects.get_for_user(organization=org, user=user, scope="project:read")
        assert result == [team]

    def test_user_no_access(self):
        user = User.objects.create(username="foo")
        user2 = User.objects.create(username="bar")
        org = self.create_organization()
        team = self.create_team(organization=org, name="Test")
        self.create_member(organization=org, user=user, teams=[team])

        result = Team.objects.get_for_user(organization=org, user=user2)
        assert result == []

    def test_with_projects(self):
        user = User.objects.create(username="foo")
        org = self.create_organization()
        team = self.create_team(organization=org, name="Test")
        self.create_member(organization=org, user=user, teams=[team])
        project = self.create_project(teams=[team], name="foo")
        project2 = self.create_project(teams=[team], name="bar")
        result = Team.objects.get_for_user(organization=org, user=user, with_projects=True)
        assert result == [(team, [project2, project])]
