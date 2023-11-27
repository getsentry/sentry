import pytest
from django.test import override_settings
from rest_framework.serializers import ValidationError

from sentry.models.notificationsettingoption import NotificationSettingOption
from sentry.models.notificationsettingprovider import NotificationSettingProvider
from sentry.models.organizationmember import OrganizationMember
from sentry.models.organizationmemberteam import OrganizationMemberTeam
from sentry.models.project import Project
from sentry.models.projectteam import ProjectTeam
from sentry.models.release import Release, ReleaseProject
from sentry.models.releaseprojectenvironment import ReleaseProjectEnvironment
from sentry.models.team import Team
from sentry.silo.base import SiloMode
from sentry.tasks.deletion.hybrid_cloud import schedule_hybrid_cloud_foreign_key_jobs_control
from sentry.testutils.cases import TestCase
from sentry.testutils.outbox import outbox_runner
from sentry.testutils.silo import assume_test_silo_mode, region_silo_test


@region_silo_test
class TeamTest(TestCase):
    def test_global_member(self):
        user = self.create_user()
        org = self.create_organization(owner=user)
        team = self.create_team(organization=org)
        member = OrganizationMember.objects.get(user_id=user.id, organization=org)
        OrganizationMemberTeam.objects.create(organizationmember=member, team=team)
        assert list(team.member_set.all()) == [member]

    def test_inactive_global_member(self):
        user = self.create_user()
        org = self.create_organization(owner=user)
        team = self.create_team(organization=org)
        OrganizationMember.objects.get(user_id=user.id, organization=org)

        assert list(team.member_set.all()) == []

    def test_active_basic_member(self):
        user = self.create_user()
        org = self.create_organization(owner=user)
        team = self.create_team(organization=org)
        user2 = self.create_user("foo@example.com")
        member = self.create_member(user=user2, organization=org, role="member", teams=[team])

        assert member in team.member_set.all()

    def test_teamless_basic_member(self):
        user = self.create_user()
        org = self.create_organization(owner=user)
        team = self.create_team(organization=org)
        user2 = self.create_user("foo@example.com")
        member = self.create_member(user=user2, organization=org, role="member", teams=[])

        assert member not in team.member_set.all()

    def test_get_projects(self):
        user = self.create_user()
        org = self.create_organization(owner=user)
        team = self.create_team(organization=org)
        project = self.create_project(teams=[team], name="name")

        projects = team.get_projects()
        assert {_.id for _ in projects} == {project.id}

    @override_settings(SENTRY_USE_SNOWFLAKE=False)
    def test_without_snowflake(self):
        user = self.create_user()
        org = self.create_organization(owner=user)
        team = self.create_team(organization=org)
        assert team.id < 1_000_000_000
        assert Team.objects.filter(id=team.id).exists()

    def test_cannot_demote_last_owner_team(self):
        org = self.create_organization()

        with pytest.raises(ValidationError):
            team = self.create_team(org, org_role="owner")
            self.create_member(
                organization=org, role="member", user=self.create_user(), teams=[team]
            )
            team.org_role = "manager"
            team.save()


@region_silo_test
class TransferTest(TestCase):
    def test_simple(self):
        user = self.create_user()
        org = self.create_organization(name="foo", owner=user)
        org2 = self.create_organization(name="bar", owner=None)
        team = self.create_team(organization=org)
        project = self.create_project(teams=[team])
        user2 = self.create_user("foo@example.com")
        self.create_member(user=user2, organization=org, role="admin", teams=[team])
        self.create_member(user=user2, organization=org2, role="member", teams=[])
        team.transfer_to(org2)

        assert team.organization == org2
        team = Team.objects.get(id=team.id)
        assert team.organization == org2

        project = Project.objects.get(id=project.id)
        assert project.organization == org2

        # owner does not exist on new org, so should not be transferred
        assert not OrganizationMember.objects.filter(user_id=user.id, organization=org2).exists()

        # existing member should now have access
        member = OrganizationMember.objects.get(user_id=user2.id, organization=org2)
        assert list(member.teams.all()) == [team]
        # role should not automatically upgrade
        assert member.role == "member"

        # old member row should still exist
        assert OrganizationMember.objects.filter(user_id=user2.id, organization=org).exists()

        # no references to old org for this team should exist
        assert not OrganizationMemberTeam.objects.filter(
            organizationmember__organization=org, team=team
        ).exists()

    def test_existing_team(self):
        org = self.create_organization(name="foo")
        org2 = self.create_organization(name="bar")
        team = self.create_team(name="foo", organization=org)
        team2 = self.create_team(name="foo", organization=org2)
        project = self.create_project(teams=[team])
        with outbox_runner():
            team.transfer_to(org2)

        project = Project.objects.get(id=project.id)
        assert ProjectTeam.objects.filter(project=project, team=team2).exists()

        assert not Team.objects.filter(id=team.id).exists()

    def test_release_projects(self):
        user = self.create_user()
        org = self.create_organization(name="foo", owner=user)
        org2 = self.create_organization(name="bar", owner=None)
        team = self.create_team(organization=org)
        project = self.create_project(teams=[team])

        release = Release.objects.create(version="a" * 7, organization=org)

        release.add_project(project)

        assert ReleaseProject.objects.filter(release=release, project=project).exists()

        team.transfer_to(org2)

        assert Release.objects.filter(id=release.id).exists()

        assert not ReleaseProject.objects.filter(release=release, project=project).exists()

    def test_release_project_envs(self):
        user = self.create_user()
        org = self.create_organization(name="foo", owner=user)
        org2 = self.create_organization(name="bar", owner=None)
        team = self.create_team(organization=org)
        project = self.create_project(teams=[team])

        release = Release.objects.create(version="a" * 7, organization=org)

        release.add_project(project)
        env = self.create_environment(name="prod", project=project)
        ReleaseProjectEnvironment.objects.create(release=release, project=project, environment=env)

        assert ReleaseProjectEnvironment.objects.filter(
            release=release, project=project, environment=env
        ).exists()

        team.transfer_to(org2)

        assert Release.objects.filter(id=release.id).exists()

        assert not ReleaseProjectEnvironment.objects.filter(
            release=release, project=project, environment=env
        ).exists()


@region_silo_test
class TeamDeletionTest(TestCase):
    def test_hybrid_cloud_deletion(self):
        org = self.create_organization()
        team = self.create_team(org)
        base_params = {
            "team_id": team.id,
            "scope_type": "team",
            "scope_identifier": team.id,
            "value": "always",
        }
        with assume_test_silo_mode(SiloMode.CONTROL):
            NotificationSettingOption.objects.create(**base_params)
            NotificationSettingProvider.objects.create(provider="slack", **base_params)

        assert Team.objects.filter(id=team.id).exists()

        team_id = team.id
        with outbox_runner():
            team.delete()

        assert not Team.objects.filter(id=team_id).exists()

        with assume_test_silo_mode(SiloMode.CONTROL):
            # cascade is asynchronous, ensure there is still related search,
            assert NotificationSettingOption.objects.filter(**base_params).exists()
            assert NotificationSettingProvider.objects.filter(**base_params).exists()

        # Run foreign key cascades to remove control silo state.
        with self.tasks(), assume_test_silo_mode(SiloMode.CONTROL):
            schedule_hybrid_cloud_foreign_key_jobs_control()

        assert not Team.objects.filter(id=team_id).exists()
        with assume_test_silo_mode(SiloMode.CONTROL):
            assert not NotificationSettingOption.objects.filter(**base_params).exists()
            assert not NotificationSettingProvider.objects.filter(**base_params).exists()

    def test_cannot_delete_last_owner_team(self):
        org = self.create_organization()

        with pytest.raises(ValidationError):
            team = self.create_team(org, org_role="owner")
            self.create_member(
                organization=org, role="member", user=self.create_user(), teams=[team]
            )
            team.delete()
