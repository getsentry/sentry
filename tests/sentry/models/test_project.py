from sentry.models import (
    Environment,
    EnvironmentProject,
    NotificationSetting,
    OrganizationMember,
    OrganizationMemberTeam,
    Project,
    ProjectOwnership,
    ProjectTeam,
    Release,
    ReleaseProject,
    ReleaseProjectEnvironment,
    Rule,
)
from sentry.models.integration import ExternalProviders
from sentry.notifications.types import (
    NotificationSettingTypes,
    NotificationSettingOptionValues,
)
from sentry.testutils import TestCase
from sentry.utils.compat import zip


class ProjectTest(TestCase):
    def test_member_set_simple(self):
        user = self.create_user()
        org = self.create_organization(owner=user)
        team = self.create_team(organization=org)
        project = self.create_project(teams=[team])
        member = OrganizationMember.objects.get(user=user, organization=org)
        OrganizationMemberTeam.objects.create(organizationmember=member, team=team)

        assert list(project.member_set.all()) == [member]

    def test_inactive_global_member(self):
        user = self.create_user()
        org = self.create_organization(owner=user)
        team = self.create_team(organization=org)
        project = self.create_project(teams=[team])
        OrganizationMember.objects.get(user=user, organization=org)

        assert list(project.member_set.all()) == []

    def test_transfer_to_team(self):
        from_org = self.create_organization()
        from_team = self.create_team(organization=from_org)
        to_org = self.create_organization()
        to_team = self.create_team(organization=to_org)

        project = self.create_project(teams=[from_team])

        rule = Rule.objects.create(
            project=project,
            environment_id=Environment.get_or_create(project, "production").id,
            label="Golden Rule",
            data={},
        )

        project.transfer_to(team=to_team)

        project = Project.objects.get(id=project.id)

        assert project.teams.count() == 1
        assert project.teams.first() == to_team
        assert project.organization_id == to_org.id

        updated_rule = project.rule_set.get(label="Golden Rule")
        assert updated_rule.id == rule.id
        assert updated_rule.environment_id != rule.environment_id
        assert updated_rule.environment_id == Environment.get_or_create(project, "production").id

    def test_transfer_to_team_slug_collision(self):
        from_org = self.create_organization()
        from_team = self.create_team(organization=from_org)
        project = self.create_project(teams=[from_team], slug="matt")
        to_org = self.create_organization()
        to_team = self.create_team(organization=to_org)
        # conflicting project slug
        self.create_project(teams=[to_team], slug="matt")

        assert Project.objects.filter(organization=to_org).count() == 1

        project.transfer_to(team=to_team)

        project = Project.objects.get(id=project.id)

        assert project.teams.count() == 1
        assert project.teams.first() == to_team
        assert project.organization_id == to_org.id
        assert project.slug != "matt"
        assert Project.objects.filter(organization=to_org).count() == 2
        assert Project.objects.filter(organization=from_org).count() == 0

    def test_transfer_to_team_releases(self):
        from_org = self.create_organization()
        from_team = self.create_team(organization=from_org)
        to_org = self.create_organization()
        to_team = self.create_team(organization=to_org)

        project = self.create_project(teams=[from_team])

        environment = Environment.get_or_create(project, "production")
        release = Release.get_or_create(project=project, version="1.0")

        ReleaseProjectEnvironment.objects.create(
            project=project, release=release, environment=environment
        )

        assert ReleaseProjectEnvironment.objects.filter(
            project=project, release=release, environment=environment
        ).exists()
        assert ReleaseProject.objects.filter(project=project, release=release).exists()

        project.transfer_to(team=to_team)

        project = Project.objects.get(id=project.id)

        assert project.teams.count() == 1
        assert project.teams.first() == to_team
        assert project.organization_id == to_org.id

        assert not ReleaseProjectEnvironment.objects.filter(
            project=project, release=release, environment=environment
        ).exists()
        assert not ReleaseProject.objects.filter(project=project, release=release).exists()

    def test_transfer_to_organization(self):
        from_org = self.create_organization()
        team = self.create_team(organization=from_org)
        to_org = self.create_organization()

        project = self.create_project(teams=[team])

        rule = Rule.objects.create(
            project=project,
            environment_id=Environment.get_or_create(project, "production").id,
            label="Golden Rule",
            data={},
        )

        project.transfer_to(organization=to_org)

        project = Project.objects.get(id=project.id)

        assert project.teams.count() == 0
        assert project.organization_id == to_org.id

        updated_rule = project.rule_set.get(label="Golden Rule")
        assert updated_rule.id == rule.id
        assert updated_rule.environment_id != rule.environment_id
        assert updated_rule.environment_id == Environment.get_or_create(project, "production").id

    def test_transfer_to_organization_slug_collision(self):
        from_org = self.create_organization()
        team = self.create_team(organization=from_org)
        project = self.create_project(teams=[team], slug="matt")
        to_org = self.create_organization()
        # conflicting project slug
        self.create_project(slug="matt", organization=to_org)

        assert Project.objects.filter(organization=to_org).count() == 1

        project.transfer_to(organization=to_org)

        project = Project.objects.get(id=project.id)

        assert project.teams.count() == 0
        assert project.organization_id == to_org.id
        assert project.slug != "matt"
        assert Project.objects.filter(organization=to_org).count() == 2
        assert Project.objects.filter(organization=from_org).count() == 0

    def test_transfer_to_organization_releases(self):
        from_org = self.create_organization()
        team = self.create_team(organization=from_org)
        to_org = self.create_organization()

        project = self.create_project(teams=[team])

        environment = Environment.get_or_create(project, "production")
        release = Release.get_or_create(project=project, version="1.0")

        ReleaseProjectEnvironment.objects.create(
            project=project, release=release, environment=environment
        )

        assert ReleaseProjectEnvironment.objects.filter(
            project=project, release=release, environment=environment
        ).exists()
        assert ReleaseProject.objects.filter(project=project, release=release).exists()

        project.transfer_to(organization=to_org)

        project = Project.objects.get(id=project.id)

        assert project.teams.count() == 0
        assert project.organization_id == to_org.id

        assert not ReleaseProjectEnvironment.objects.filter(
            project=project, release=release, environment=environment
        ).exists()
        assert not ReleaseProject.objects.filter(project=project, release=release).exists()


class CopyProjectSettingsTest(TestCase):
    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)

        self.options_dict = {
            "sentry:resolve_age": 1,
            "sentry:scrub_data": False,
            "sentry:scrub_defaults": False,
        }
        self.other_project = self.create_project()
        for key, value in self.options_dict.items():
            self.other_project.update_option(key=key, value=value)

        self.teams = [self.create_team(), self.create_team(), self.create_team()]

        for team in self.teams:
            ProjectTeam.objects.create(team=team, project=self.other_project)

        self.environments = [
            self.create_environment(project=self.other_project),
            self.create_environment(project=self.other_project),
        ]

        self.ownership = ProjectOwnership.objects.create(
            project=self.other_project, raw='{"hello":"hello"}', schema={"hello": "hello"}
        )

        Rule.objects.create(project=self.other_project, label="rule1")
        Rule.objects.create(project=self.other_project, label="rule2")
        Rule.objects.create(project=self.other_project, label="rule3")
        # there is a default rule added to project
        self.rules = Rule.objects.filter(project_id=self.other_project.id).order_by("label")

    def assert_other_project_settings_not_changed(self):
        # other_project should not have changed. This should check that.
        self.assert_settings_copied(self.other_project)

    def assert_settings_copied(self, project):
        for key, value in self.options_dict.items():
            assert project.get_option(key) == value

        project_teams = ProjectTeam.objects.filter(project_id=project.id, team__in=self.teams)
        assert len(project_teams) == len(self.teams)

        project_env = EnvironmentProject.objects.filter(
            project_id=project.id, environment__in=self.environments
        )
        assert len(project_env) == len(self.environments)

        ownership = ProjectOwnership.objects.get(project_id=project.id)
        assert ownership.raw == self.ownership.raw
        assert ownership.schema == self.ownership.schema

        rules = Rule.objects.filter(project_id=project.id).order_by("label")
        for rule, other_rule in zip(rules, self.rules):
            assert rule.label == other_rule.label

    def assert_settings_not_copied(self, project, teams=()):
        for key in self.options_dict.keys():
            assert project.get_option(key) is None

        project_teams = ProjectTeam.objects.filter(project_id=project.id, team__in=teams)
        assert len(project_teams) == len(teams)

        project_envs = EnvironmentProject.objects.filter(project_id=project.id)
        assert len(project_envs) == 0

        assert not ProjectOwnership.objects.filter(project_id=project.id).exists()

        # default rule
        rules = Rule.objects.filter(project_id=project.id)
        assert len(rules) == 1
        assert rules[0].label == "Send a notification for new issues"

    def test_simple(self):
        project = self.create_project(fire_project_created=True)

        assert project.copy_settings_from(self.other_project.id)
        self.assert_settings_copied(project)
        self.assert_other_project_settings_not_changed()

    def test_copy_with_previous_settings(self):
        project = self.create_project(fire_project_created=True)
        project.update_option("sentry:resolve_age", 200)
        ProjectTeam.objects.create(team=self.create_team(), project=project)
        self.create_environment(project=project)
        Rule.objects.filter(project_id=project.id)[0]

        assert project.copy_settings_from(self.other_project.id)
        self.assert_settings_copied(project)
        self.assert_other_project_settings_not_changed()


class FilterToSubscribedUsersTest(TestCase):
    def run_test(self, users, expected_users):
        assert self.project.filter_to_subscribed_users(users) == expected_users

    def test(self):
        assert self.project.filter_to_subscribed_users([self.user]) == [self.user]

    def test_global_enabled(self):
        user = self.create_user()
        NotificationSetting.objects.update_settings(
            ExternalProviders.EMAIL,
            NotificationSettingTypes.ISSUE_ALERTS,
            NotificationSettingOptionValues.ALWAYS,
            user=user,
        )
        self.run_test([user], [user])

    def test_global_disabled(self):
        user = self.create_user()
        NotificationSetting.objects.update_settings(
            ExternalProviders.EMAIL,
            NotificationSettingTypes.ISSUE_ALERTS,
            NotificationSettingOptionValues.NEVER,
            user=user,
        )
        self.run_test([user], [])

    def test_project_enabled(self):
        user = self.create_user()
        NotificationSetting.objects.update_settings(
            ExternalProviders.EMAIL,
            NotificationSettingTypes.ISSUE_ALERTS,
            NotificationSettingOptionValues.NEVER,
            user=user,
        )
        NotificationSetting.objects.update_settings(
            ExternalProviders.EMAIL,
            NotificationSettingTypes.ISSUE_ALERTS,
            NotificationSettingOptionValues.ALWAYS,
            user=user,
            project=self.project,
        )
        self.run_test([user], [user])

    def test_project_disabled(self):
        user = self.create_user()
        NotificationSetting.objects.update_settings(
            ExternalProviders.EMAIL,
            NotificationSettingTypes.ISSUE_ALERTS,
            NotificationSettingOptionValues.ALWAYS,
            user=user,
        )
        NotificationSetting.objects.update_settings(
            ExternalProviders.EMAIL,
            NotificationSettingTypes.ISSUE_ALERTS,
            NotificationSettingOptionValues.NEVER,
            user=user,
            project=self.project,
        )
        self.run_test([user], [])

    def test_mixed(self):
        user_global_enabled = self.create_user()
        NotificationSetting.objects.update_settings(
            ExternalProviders.EMAIL,
            NotificationSettingTypes.ISSUE_ALERTS,
            NotificationSettingOptionValues.ALWAYS,
            user=user_global_enabled,
        )

        user_global_disabled = self.create_user()
        NotificationSetting.objects.update_settings(
            ExternalProviders.EMAIL,
            NotificationSettingTypes.ISSUE_ALERTS,
            NotificationSettingOptionValues.NEVER,
            user=user_global_disabled,
        )

        user_project_enabled = self.create_user()
        NotificationSetting.objects.update_settings(
            ExternalProviders.EMAIL,
            NotificationSettingTypes.ISSUE_ALERTS,
            NotificationSettingOptionValues.NEVER,
            user=user_project_enabled,
        )
        NotificationSetting.objects.update_settings(
            ExternalProviders.EMAIL,
            NotificationSettingTypes.ISSUE_ALERTS,
            NotificationSettingOptionValues.ALWAYS,
            user=user_project_enabled,
            project=self.project,
        )

        user_project_disabled = self.create_user()
        NotificationSetting.objects.update_settings(
            ExternalProviders.EMAIL,
            NotificationSettingTypes.ISSUE_ALERTS,
            NotificationSettingOptionValues.ALWAYS,
            user=user_project_disabled,
        )
        NotificationSetting.objects.update_settings(
            ExternalProviders.EMAIL,
            NotificationSettingTypes.ISSUE_ALERTS,
            NotificationSettingOptionValues.NEVER,
            user=user_project_disabled,
            project=self.project,
        )
        self.run_test(
            [
                user_global_enabled,
                user_global_disabled,
                user_project_enabled,
                user_project_disabled,
            ],
            [user_global_enabled, user_project_enabled],
        )
