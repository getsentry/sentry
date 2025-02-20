from collections.abc import Iterable
from unittest.mock import patch

from sentry.deletions.models.scheduleddeletion import RegionScheduledDeletion
from sentry.deletions.tasks.hybrid_cloud import schedule_hybrid_cloud_foreign_key_jobs_control
from sentry.grouping.grouptype import ErrorGroupType
from sentry.integrations.models.external_issue import ExternalIssue
from sentry.integrations.types import ExternalProviders
from sentry.models.environment import Environment, EnvironmentProject
from sentry.models.grouplink import GroupLink
from sentry.models.options.project_option import ProjectOption
from sentry.models.options.project_template_option import ProjectTemplateOption
from sentry.models.organizationmember import OrganizationMember
from sentry.models.organizationmemberteam import OrganizationMemberTeam
from sentry.models.project import Project
from sentry.models.projectownership import ProjectOwnership
from sentry.models.projectteam import ProjectTeam
from sentry.models.release import Release
from sentry.models.releaseprojectenvironment import ReleaseProjectEnvironment
from sentry.models.releases.release_project import ReleaseProject
from sentry.models.rule import Rule
from sentry.monitors.models import Monitor, MonitorEnvironment, MonitorType, ScheduleType
from sentry.notifications.models.notificationsettingoption import NotificationSettingOption
from sentry.notifications.types import NotificationSettingEnum
from sentry.notifications.utils.participants import get_notification_recipients
from sentry.silo.base import SiloMode
from sentry.snuba.models import SnubaQuery
from sentry.testutils.cases import APITestCase, TestCase
from sentry.testutils.helpers.features import with_feature
from sentry.testutils.outbox import outbox_runner
from sentry.testutils.silo import assume_test_silo_mode, control_silo_test
from sentry.types.actor import Actor
from sentry.users.models.user import User
from sentry.users.models.user_option import UserOption
from sentry.workflow_engine.models import Detector


class ProjectTest(APITestCase, TestCase):
    def test_member_set_simple(self):
        user = self.create_user()
        org = self.create_organization(owner=user)
        team = self.create_team(organization=org)
        project = self.create_project(teams=[team])
        member = OrganizationMember.objects.get(user_id=user.id, organization=org)
        OrganizationMemberTeam.objects.create(organizationmember=member, team=team)

        assert list(project.member_set.all()) == [member]

    def test_inactive_global_member(self):
        user = self.create_user()
        org = self.create_organization(owner=user)
        team = self.create_team(organization=org)
        project = self.create_project(teams=[team])
        OrganizationMember.objects.get(user_id=user.id, organization=org)

        assert list(project.member_set.all()) == []

    def test_transfer_to_organization(self):
        from_org = self.create_organization()
        team = self.create_team(organization=from_org)
        to_org = self.create_organization()

        project = self.create_project(teams=[team])
        project_other = self.create_project(teams=[team])

        rule = Rule.objects.create(
            project=project,
            environment_id=Environment.get_or_create(project, "production").id,
            label="Golden Rule",
            data={},
        )
        environment_from_new = self.create_environment(organization=from_org)
        environment_from_existing = self.create_environment(organization=from_org)
        environment_to_existing = self.create_environment(
            organization=to_org, name=environment_from_existing.name
        )

        monitor = Monitor.objects.create(
            name="test-monitor",
            slug="test-monitor",
            organization_id=from_org.id,
            project_id=project.id,
            type=MonitorType.CRON_JOB,
            config={"schedule": [1, "month"], "schedule_type": ScheduleType.INTERVAL},
        )

        monitor_also = Monitor.objects.create(
            name="test-monitor-also",
            slug="test-monitor-also",
            organization_id=from_org.id,
            project_id=project.id,
            type=MonitorType.CRON_JOB,
            config={"schedule": [1, "month"], "schedule_type": ScheduleType.INTERVAL},
        )
        monitor_env_new = MonitorEnvironment.objects.create(
            monitor=monitor_also, environment_id=environment_from_new.id
        )
        monitor_env_existing = MonitorEnvironment.objects.create(
            monitor=monitor_also, environment_id=environment_from_existing.id
        )

        monitor_other = Monitor.objects.create(
            name="test-monitor-other",
            slug="test-monitor-other",
            organization_id=from_org.id,
            project_id=project_other.id,
            type=MonitorType.CRON_JOB,
            config={"schedule": [1, "month"], "schedule_type": ScheduleType.INTERVAL},
        )

        monitor_to = Monitor.objects.create(
            name="test-monitor",
            slug="test-monitor",
            organization_id=to_org.id,
            project_id=self.create_project(name="other-project").id,
            type=MonitorType.CRON_JOB,
            config={"schedule": [1, "month"], "schedule_type": ScheduleType.INTERVAL},
        )

        project.transfer_to(organization=to_org)

        project = Project.objects.get(id=project.id)

        assert project.teams.count() == 0
        assert project.organization_id == to_org.id

        updated_rule = project.rule_set.get(label="Golden Rule")
        assert updated_rule.id == rule.id
        assert updated_rule.environment_id != rule.environment_id
        assert updated_rule.environment_id == Environment.get_or_create(project, "production").id

        # check to make sure old monitor is scheduled for deletion
        assert RegionScheduledDeletion.objects.filter(
            object_id=monitor.id, model_name="Monitor"
        ).exists()

        updated_monitor = Monitor.objects.get(slug="test-monitor-also")
        assert updated_monitor.id == monitor_also.id
        assert updated_monitor.organization_id == to_org.id
        assert updated_monitor.project_id == project.id
        monitor_env_new.refresh_from_db()
        environment_to_new = Environment.objects.get(id=monitor_env_new.environment_id)
        assert environment_to_new.organization_id == to_org.id
        assert environment_to_new.name == environment_from_new.name
        monitor_env_existing.refresh_from_db()
        assert monitor_env_existing.environment_id == environment_to_existing.id

        unmoved_monitor = Monitor.objects.get(slug="test-monitor-other")
        assert unmoved_monitor.id == monitor_other.id
        assert unmoved_monitor.organization_id == from_org.id
        assert unmoved_monitor.project_id == project_other.id

        existing_monitor = Monitor.objects.get(id=monitor_to.id)
        assert existing_monitor.id == monitor_to.id
        assert existing_monitor.organization_id == to_org.id
        assert existing_monitor.project_id == monitor_to.project_id

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

        def project_props(proj: Project):
            return {
                "id": proj.id,
                "slug": proj.slug,
                "name": proj.name,
                "forced_color": proj.forced_color,
                "public": proj.public,
                "date_added": proj.date_added,
                "status": proj.status,
                "first_event": proj.first_event,
                "flags": proj.flags,
                "platform": proj.platform,
            }

        project_before = project_props(project)

        environment = Environment.get_or_create(project, "production")
        release = Release.get_or_create(project=project, version="1.0")

        ReleaseProjectEnvironment.objects.create(
            project=project, release=release, environment=environment
        )

        assert Environment.objects.filter(id=environment.id).exists()
        assert Environment.objects.filter(organization_id=from_org.id, projects=project).exists()

        assert EnvironmentProject.objects.filter(environment=environment, project=project).exists()
        assert ReleaseProjectEnvironment.objects.filter(
            project=project, release=release, environment=environment
        ).exists()
        assert ReleaseProject.objects.filter(project=project, release=release).exists()

        project.transfer_to(organization=to_org)

        project = Project.objects.get(id=project.id)
        project_after = project_props(project)

        assert project_before == project_after
        assert project.teams.count() == 0
        assert project.organization_id == to_org.id

        assert Environment.objects.filter(id=environment.id).exists()
        assert not EnvironmentProject.objects.filter(
            environment=environment, project=project
        ).exists()
        assert not ReleaseProjectEnvironment.objects.filter(
            project=project, release=release, environment=environment
        ).exists()
        assert not ReleaseProject.objects.filter(project=project, release=release).exists()

    def test_transfer_to_organization_alert_rules(self):
        from_org = self.create_organization()
        from_user = self.create_user()
        self.create_member(user=from_user, role="member", organization=from_org)
        team = self.create_team(organization=from_org)
        to_org = self.create_organization()
        to_team = self.create_team(organization=to_org)
        to_user = self.create_user()
        self.create_member(user=to_user, role="member", organization=to_org)

        project = self.create_project(teams=[team])
        environment = Environment.get_or_create(project, "production")

        # should lose their owners
        alert_rule = self.create_alert_rule(
            organization=self.organization,
            projects=[project],
            owner=Actor.from_identifier(f"team:{team.id}"),
            environment=environment,
        )
        snuba_query = SnubaQuery.objects.filter(id=alert_rule.snuba_query_id).get()
        rule1 = Rule.objects.create(label="another test rule", project=project, owner_team=team)
        rule2 = Rule.objects.create(
            label="rule4",
            project=project,
            owner_user_id=from_user.id,
        )

        # should keep their owners
        rule3 = Rule.objects.create(label="rule2", project=project, owner_team=to_team)
        rule4 = Rule.objects.create(
            label="rule3",
            project=project,
            owner_user_id=to_user.id,
        )

        assert EnvironmentProject.objects.count() == 1
        assert snuba_query.environment is not None
        assert snuba_query.environment.id == environment.id

        project.transfer_to(organization=to_org)

        alert_rule.refresh_from_db()
        rule1.refresh_from_db()
        rule2.refresh_from_db()
        rule3.refresh_from_db()
        rule4.refresh_from_db()
        snuba_query.refresh_from_db()

        assert (
            Environment.objects.exclude(id=environment.id).count() == 1
        )  # not the same as the from_org env
        assert EnvironmentProject.objects.count() == 1
        assert snuba_query.environment != environment
        assert alert_rule.organization_id == to_org.id
        assert alert_rule.user_id is None
        assert alert_rule.team_id is None

        for rule in (rule1, rule2):
            assert rule.owner_user_id is None
            assert rule.owner_team_id is None

        assert rule3.owner_user_id is None
        assert rule3.owner_team_id

        assert rule4.owner_user_id
        assert rule4.owner_team_id is None

    def test_transfer_to_organization_external_issues(self):
        from_org = self.create_organization()
        to_org = self.create_organization()

        project = self.create_project(organization=from_org)
        group = self.create_group(project=project)
        other_project = self.create_project(organization=from_org)
        other_group = self.create_group(project=other_project)

        self.integration = self.create_integration(
            organization=self.organization,
            provider="jira",
            name="Jira",
            external_id="jira:1",
        )
        ext_issue = ExternalIssue.objects.create(
            organization_id=from_org.id,
            integration_id=self.integration.id,
            key="123",
        )
        other_ext_issue = ExternalIssue.objects.create(
            organization_id=from_org.id,
            integration_id=self.integration.id,
            key="124",
        )
        group_link = GroupLink.objects.create(
            group_id=group.id,
            project_id=group.project_id,
            linked_type=GroupLink.LinkedType.issue,
            linked_id=ext_issue.id,
        )
        other_group_link = GroupLink.objects.create(
            group_id=other_group.id,
            project_id=other_group.project_id,
            linked_type=GroupLink.LinkedType.issue,
            linked_id=other_ext_issue.id,
        )

        project.transfer_to(organization=to_org)
        project.refresh_from_db()
        other_project.refresh_from_db()
        ext_issue.refresh_from_db()
        other_ext_issue.refresh_from_db()
        group_link.refresh_from_db()
        other_group_link.refresh_from_db()

        assert project.organization_id == to_org.id
        assert ext_issue.organization_id == to_org.id
        assert group_link.project_id == project.id

        assert other_project.organization_id == from_org.id
        assert other_ext_issue.organization_id == from_org.id
        assert other_group_link.project_id == other_project.id

    def test_get_absolute_url(self):
        url = self.project.get_absolute_url()
        assert (
            url
            == f"http://testserver/organizations/{self.organization.slug}/issues/?project={self.project.id}"
        )

        url = self.project.get_absolute_url(params={"q": "all"})
        assert (
            url
            == f"http://testserver/organizations/{self.organization.slug}/issues/?q=all&project={self.project.id}"
        )

    @with_feature("system:multi-region")
    def test_get_absolute_url_customer_domains(self):
        url = self.project.get_absolute_url()
        assert (
            url == f"http://{self.organization.slug}.testserver/issues/?project={self.project.id}"
        )

    def test_get_next_short_id_simple(self):
        with patch("sentry.models.Counter.increment", return_value=1231):
            assert self.project.next_short_id() == 1231

    def test_next_short_id_increments_by_one_if_no_delta_passed(self):
        assert self.project.next_short_id() == 1
        assert self.project.next_short_id() == 2

    def test_get_next_short_id_increments_by_delta_value(self):
        assert self.project.next_short_id() == 1
        assert self.project.next_short_id(delta=2) == 3

    def test_add_team(self):
        team = self.create_team(organization=self.organization)
        assert self.project.add_team(team)

        teams = self.project.teams.all()
        assert team.id in {t.id for t in teams}

    def test_remove_team_clears_alerts(self):
        team = self.create_team(organization=self.organization)
        assert self.project.add_team(team)

        rule = Rule.objects.create(project=self.project, label="issa rule", owner_team_id=team.id)
        alert_rule = self.create_alert_rule(
            organization=self.organization, owner=Actor.from_id(team_id=team.id)
        )
        self.project.remove_team(team)

        rule.refresh_from_db()
        assert rule.owner_team_id is None
        assert rule.owner_user_id is None

        alert_rule.refresh_from_db()
        assert alert_rule.team_id is None
        assert alert_rule.user_id is None

    def test_project_detector(self):
        project = self.create_project()
        assert not Detector.objects.filter(project=project, type=ErrorGroupType.slug).exists()

        with self.feature({"organizations:workflow-engine-issue-alert-dual-write": True}):
            project = self.create_project()
            assert Detector.objects.filter(project=project, type=ErrorGroupType.slug).exists()


class ProjectOptionsTests(TestCase):
    """
    These tests validate that the project model will correctly merge the
    options from the project and the project template.

    When returning getting options for a project the following hierarchy is used:
    - Project
    - Project Template
    - Default

    If a project has a template option set, it will override the default.
    If a project has an option set, it will override the template option.
    """

    def setUp(self):
        super().setUp()
        self.option_key = "sentry:test_data"
        self.project = self.create_project()

        self.project_template = self.create_project_template(organization=self.project.organization)
        self.project.template = self.project_template

    def tearDown(self):
        super().tearDown()

        self.project_template.delete()
        self.project.delete()

    def test_get_option(self):
        assert self.project.get_option(self.option_key) is None
        ProjectOption.objects.set_value(self.project, self.option_key, True)
        assert self.project.get_option(self.option_key) is True

    def test_get_template_option(self):
        assert self.project.get_option(self.option_key) is None
        ProjectTemplateOption.objects.set_value(self.project_template, self.option_key, "test")
        assert self.project.get_option(self.option_key) == "test"

    def test_get_option__override_template(self):
        assert self.project.get_option(self.option_key) is None
        ProjectOption.objects.set_value(self.project, self.option_key, True)
        ProjectTemplateOption.objects.set_value(self.project_template, self.option_key, "test")

        assert self.project.get_option(self.option_key) is True

    def test_get_option__without_template(self):
        self.project.template = None
        assert self.project.get_option(self.option_key) is None
        ProjectTemplateOption.objects.set_value(self.project_template, self.option_key, "test")

        assert self.project.get_option(self.option_key) is None

    def test_get_option__without_template_and_value(self):
        self.project.template = None
        assert self.project.get_option(self.option_key) is None

        ProjectOption.objects.set_value(self.project, self.option_key, True)
        ProjectTemplateOption.objects.set_value(self.project_template, self.option_key, "test")

        assert self.project.get_option(self.option_key) is True


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


@control_silo_test
class FilterToSubscribedUsersTest(TestCase):
    def run_test(self, users: Iterable[User], expected_users: Iterable[User]):
        recipients = get_notification_recipients(
            recipients=Actor.many_from_object(users),
            type=NotificationSettingEnum.ISSUE_ALERTS,
            project_ids=[self.project.id],
            organization_id=self.project.organization.id,
        )
        actual_recipients = recipients[ExternalProviders.EMAIL]
        expected_recipients = {Actor.from_object(user) for user in expected_users}
        assert actual_recipients == expected_recipients

    def test(self):
        self.run_test([self.user], {self.user})

    def test_global_enabled(self):
        user = self.create_user()
        self.run_test({user}, {user})

    def test_global_disabled(self):
        user = self.create_user()
        NotificationSettingOption.objects.create(
            user_id=user.id,
            scope_type="user",
            scope_identifier=user.id,
            type="alerts",
            value="never",
        )
        self.run_test({user}, set())

    def test_project_enabled(self):
        user = self.create_user()

        # disable default
        NotificationSettingOption.objects.create(
            user_id=user.id,
            scope_type="user",
            scope_identifier=user.id,
            type="alerts",
            value="never",
        )
        # override project
        NotificationSettingOption.objects.create(
            user_id=user.id,
            scope_type="project",
            scope_identifier=self.project.id,
            type="alerts",
            value="always",
        )
        self.run_test({user}, {user})

    def test_project_disabled(self):
        user = self.create_user()
        NotificationSettingOption.objects.create(
            user_id=user.id,
            scope_type="project",
            scope_identifier=self.project.id,
            type="alerts",
            value="never",
        )
        self.run_test({user}, set())

    def test_mixed(self):
        user_global_enabled = self.create_user()
        user_global_disabled = self.create_user()
        NotificationSettingOption.objects.create(
            user_id=user_global_disabled.id,
            scope_type="user",
            scope_identifier=user_global_disabled.id,
            type="alerts",
            value="never",
        )
        user_project_enabled = self.create_user()
        NotificationSettingOption.objects.create(
            user_id=user_project_enabled.id,
            scope_type="user",
            scope_identifier=user_project_enabled.id,
            type="alerts",
            value="never",
        )
        NotificationSettingOption.objects.create(
            user_id=user_project_enabled.id,
            scope_type="project",
            scope_identifier=self.project.id,
            type="alerts",
            value="always",
        )

        user_project_disabled = self.create_user()
        NotificationSettingOption.objects.create(
            user_id=user_project_disabled.id,
            scope_type="user",
            scope_identifier=user_project_disabled.id,
            type="alerts",
            value="never",
        )
        self.run_test(
            {
                user_global_enabled,
                user_global_disabled,
                user_project_enabled,
                user_project_disabled,
            },
            {user_global_enabled, user_project_enabled},
        )


class ProjectDeletionTest(TestCase):
    def test_hybrid_cloud_deletion(self):
        proj = self.create_project()
        user = self.create_user()
        proj_id = proj.id

        with assume_test_silo_mode(SiloMode.CONTROL):
            UserOption.objects.set_value(user, "cool_key", "Hello!", project_id=proj.id)

        with outbox_runner():
            proj.delete()

        assert not Project.objects.filter(id=proj_id).exists()

        # cascade is asynchronous, ensure there is still related search,
        with assume_test_silo_mode(SiloMode.CONTROL):
            assert UserOption.objects.filter(project_id=proj_id).exists()

            with self.tasks():
                schedule_hybrid_cloud_foreign_key_jobs_control()

            # Ensure they are all now gone.
            assert not UserOption.objects.filter(project_id=proj_id).exists()
