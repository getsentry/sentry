from sentry.models import ExternalActor, Integration, NotificationSetting, ProjectTeam, Rule
from sentry.notifications.types import (
    NotificationScopeType,
    NotificationSettingOptionValues,
    NotificationSettingTypes,
)
from sentry.testutils import APITestCase
from sentry.types.integrations import ExternalProviders


class ProjectTeamDetailsTest(APITestCase):
    endpoint = "sentry-api-0-project-team-details"

    def setUp(self):
        super().setUp()
        self.login_as(self.user)


class ProjectTeamDetailsPostTest(ProjectTeamDetailsTest):
    method = "post"

    def test_add_team(self):
        project = self.create_project()
        team = self.create_team()

        self.get_valid_response(project.organization.slug, project.slug, team.slug, status_code=201)

        assert ProjectTeam.objects.filter(project=project, team=team).exists()

    def test_add_team_not_found(self):
        project = self.create_project()

        self.get_valid_response(
            project.organization.slug, project.slug, "not-a-team", status_code=404
        )

    def test_notification_setting_updated(self):
        """
        Test that if a team already has notification settings enabled and adds another project to the team that a notification setting is created for the new project
        """
        # have some existing settings
        team = self.create_team()
        project = self.create_project(teams=[team])
        integration = Integration.objects.create(
            provider="slack",
            name="Slack",
            external_id="slack:1",
            metadata={
                "access_token": "xoxp-xxxxxxxxx-xxxxxxxxxx-xxxxxxxxxxxx",
                "installation_type": "born_as_bot",
            },
        )
        integration.add_organization(self.organization, self.user)
        ExternalActor.objects.create(
            actor=team.actor,
            organization=self.organization,
            integration=integration,
            provider=ExternalProviders.SLACK.value,
            external_name="goma",
            external_id="CXXXXXXX2",
        )
        NotificationSetting.objects.update_settings(
            ExternalProviders.SLACK,
            NotificationSettingTypes.ISSUE_ALERTS,
            NotificationSettingOptionValues.ALWAYS,
            project=project,
            team=team,
        )
        # create another project that will be added to the team and should get settings added
        project2 = self.create_project()
        self.get_valid_response(
            project2.organization.slug, project2.slug, team.slug, status_code=201
        )
        team_settings = NotificationSetting.objects.filter(
            scope_type=NotificationScopeType.PROJECT.value, target=team.actor.id
        )
        assert len(team_settings) == 2

    def test_notification_setting_not_updated(self):
        """
        Ensure that if the team does not have any notification settings, we do not try to add one when a new project is added
        """
        project = self.create_project()
        team = self.create_team()

        self.get_valid_response(project.organization.slug, project.slug, team.slug, status_code=201)

        team_settings = NotificationSetting.objects.filter(
            scope_type=NotificationScopeType.TEAM.value, target=team.actor.id
        ).exists()
        assert not team_settings


class ProjectTeamDetailsDeleteTest(ProjectTeamDetailsTest):
    method = "delete"

    def test_remove_team(self):
        team = self.create_team(members=[self.user])
        project = self.create_project(teams=[team])
        another_project = self.create_project(teams=[team])

        # Associate rules with the team that also get deleted:
        # self.create_rule(name="test_rule", owner=f"team:{team.id}")
        r1 = Rule.objects.create(label="test rule", project=project, owner=team.actor)
        r2 = Rule.objects.create(
            label="another test rule", project=another_project, owner=team.actor
        )
        ar1 = self.create_alert_rule(
            name="test alert rule", owner=team.actor.get_actor_tuple(), projects=[project]
        )
        ar2 = self.create_alert_rule(
            name="another test alert rule",
            owner=team.actor.get_actor_tuple(),
            projects=[another_project],
        )

        assert r1.owner == r2.owner == ar1.owner == ar2.owner == team.actor

        self.get_valid_response(project.organization.slug, project.slug, team.slug)
        assert not ProjectTeam.objects.filter(project=project, team=team).exists()

        r1.refresh_from_db()
        r2.refresh_from_db()
        ar1.refresh_from_db()
        ar2.refresh_from_db()

        assert r1.owner == ar1.owner is None
        assert r2.owner == ar2.owner == team.actor

        self.get_valid_response(project.organization.slug, another_project.slug, team.slug)

        r1.refresh_from_db()
        r2.refresh_from_db()
        ar1.refresh_from_db()
        ar2.refresh_from_db()

        assert r1.owner == r2.owner == ar1.owner == ar2.owner is None

    def test_remove_team_not_found(self):
        project = self.create_project()

        self.get_valid_response(
            project.organization.slug, project.slug, "not-a-team", status_code=404
        )

    def test_notification_setting_removed(self):
        """
        Test that if a team already has notification settings enabled and removes a project from the team that that notification setting is removed
        """
        # have an existing setting
        team = self.create_team()
        project = self.create_project(teams=[team])
        integration = Integration.objects.create(
            provider="slack",
            name="Slack",
            external_id="slack:1",
            metadata={
                "access_token": "xoxp-xxxxxxxxx-xxxxxxxxxx-xxxxxxxxxxxx",
                "installation_type": "born_as_bot",
            },
        )
        integration.add_organization(self.organization, self.user)
        ExternalActor.objects.create(
            actor=team.actor,
            organization=self.organization,
            integration=integration,
            provider=ExternalProviders.SLACK.value,
            external_name="goma",
            external_id="CXXXXXXX2",
        )
        NotificationSetting.objects.update_settings(
            ExternalProviders.SLACK,
            NotificationSettingTypes.ISSUE_ALERTS,
            NotificationSettingOptionValues.ALWAYS,
            project=project,
            team=team,
        )
        self.get_valid_response(project.organization.slug, project.slug, team.slug)
        team_settings = NotificationSetting.objects.filter(
            scope_type=NotificationScopeType.PROJECT.value, target=team.actor.id
        ).exists()
        assert not team_settings
