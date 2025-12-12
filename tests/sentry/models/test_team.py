from django.db import connection
from django.test import override_settings

from sentry.deletions.tasks.hybrid_cloud import schedule_hybrid_cloud_foreign_key_jobs_control
from sentry.models.organizationmember import OrganizationMember
from sentry.models.organizationmemberteam import OrganizationMemberTeam
from sentry.models.team import Team
from sentry.notifications.models.notificationsettingoption import NotificationSettingOption
from sentry.notifications.models.notificationsettingprovider import NotificationSettingProvider
from sentry.silo.base import SiloMode
from sentry.testutils.cases import TestCase
from sentry.testutils.outbox import outbox_runner
from sentry.testutils.silo import assume_test_silo_mode


class TeamTest(TestCase):
    def test_global_member(self) -> None:
        user = self.create_user()
        org = self.create_organization(owner=user)
        team = self.create_team(organization=org)
        member = OrganizationMember.objects.get(user_id=user.id, organization=org)
        OrganizationMemberTeam.objects.create(organizationmember=member, team=team)
        assert list(team.member_set.all()) == [member]

    def test_inactive_global_member(self) -> None:
        user = self.create_user()
        org = self.create_organization(owner=user)
        team = self.create_team(organization=org)
        OrganizationMember.objects.get(user_id=user.id, organization=org)

        assert list(team.member_set.all()) == []

    def test_active_basic_member(self) -> None:
        user = self.create_user()
        org = self.create_organization(owner=user)
        team = self.create_team(organization=org)
        user2 = self.create_user("foo@example.com")
        member = self.create_member(user=user2, organization=org, role="member", teams=[team])

        assert member in team.member_set.all()

    def test_teamless_basic_member(self) -> None:
        user = self.create_user()
        org = self.create_organization(owner=user)
        team = self.create_team(organization=org)
        user2 = self.create_user("foo@example.com")
        member = self.create_member(user=user2, organization=org, role="member", teams=[])

        assert member not in team.member_set.all()

    def test_get_projects(self) -> None:
        user = self.create_user()
        org = self.create_organization(owner=user)
        team = self.create_team(organization=org)
        project = self.create_project(teams=[team], name="name")

        projects = team.get_projects()
        assert {_.id for _ in projects} == {project.id}

    @override_settings(SENTRY_USE_SNOWFLAKE=False)
    def test_without_snowflake(self) -> None:
        user = self.create_user()
        org = self.create_organization(owner=user)

        with connection.cursor() as cursor:
            cursor.execute("SELECT last_value FROM sentry_team_id_seq")
            id_before = cursor.fetchone()[0]

        team = self.create_team(organization=org)

        with connection.cursor() as cursor:
            cursor.execute("SELECT last_value FROM sentry_team_id_seq")
            id_after = cursor.fetchone()[0]

        # When snowflake is disabled, the ID should advance by exactly 1
        # (Tests that we used regular auto-increment, not snowflake generation)
        assert id_after == id_before + 1
        assert team.id == id_after
        assert Team.objects.filter(id=team.id).exists()


class TeamDeletionTest(TestCase):
    def test_hybrid_cloud_deletion(self) -> None:
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
