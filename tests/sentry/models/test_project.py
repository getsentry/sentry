from typing import Iterable

from sentry.models.actor import ActorTuple, get_actor_for_user
from sentry.models.environment import Environment, EnvironmentProject
from sentry.models.grouplink import GroupLink
from sentry.models.integrations.external_issue import ExternalIssue
from sentry.models.notificationsettingoption import NotificationSettingOption
from sentry.models.options.user_option import UserOption
from sentry.models.organizationmember import OrganizationMember
from sentry.models.organizationmemberteam import OrganizationMemberTeam
from sentry.models.project import Project
from sentry.models.projectownership import ProjectOwnership
from sentry.models.projectteam import ProjectTeam
from sentry.models.release import Release, ReleaseProject
from sentry.models.releaseprojectenvironment import ReleaseProjectEnvironment
from sentry.models.rule import Rule
from sentry.models.scheduledeletion import RegionScheduledDeletion
from sentry.models.user import User
from sentry.monitors.models import Monitor, MonitorType, ScheduleType
from sentry.notifications.types import NotificationSettingEnum
from sentry.notifications.utils.participants import get_notification_recipients
from sentry.services.hybrid_cloud.actor import RpcActor
from sentry.silo.base import SiloMode
from sentry.snuba.models import SnubaQuery
from sentry.tasks.deletion.hybrid_cloud import schedule_hybrid_cloud_foreign_key_jobs_control
from sentry.testutils.cases import APITestCase, TestCase
from sentry.testutils.helpers.features import with_feature
from sentry.testutils.outbox import outbox_runner
from sentry.testutils.silo import assume_test_silo_mode, region_silo_test
from sentry.types.integrations import ExternalProviders


@region_silo_test
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

        rule = Rule.objects.create(
            project=project,
            environment_id=Environment.get_or_create(project, "production").id,
            label="Golden Rule",
            data={},
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

        updated_monitor = Monitor.objects.get(name="test-monitor-also")
        assert updated_monitor.id == monitor_also.id
        assert updated_monitor.organization_id != monitor_also.organization_id
        assert updated_monitor.project_id == monitor_also.project_id

        existing_monitor = Monitor.objects.get(id=monitor_to.id)
        assert existing_monitor.id == monitor_to.id
        assert existing_monitor.organization_id == monitor_to.organization_id
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
            owner=ActorTuple.from_actor_identifier(f"team:{team.id}"),
            environment=environment,
        )
        snuba_query = SnubaQuery.objects.filter(id=alert_rule.snuba_query_id).get()
        rule1 = Rule.objects.create(label="another test rule", project=project, owner=team.actor)
        rule2 = Rule.objects.create(
            label="rule4", project=project, owner=get_actor_for_user(from_user)
        )

        # should keep their owners
        rule3 = Rule.objects.create(label="rule2", project=project, owner=to_team.actor)
        rule4 = Rule.objects.create(
            label="rule3", project=project, owner=get_actor_for_user(to_user)
        )

        assert EnvironmentProject.objects.count() == 1
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
        assert alert_rule.owner is None
        assert rule1.owner is None
        assert rule2.owner is None
        assert rule3.owner is not None
        assert rule4.owner is not None

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

    @with_feature("organizations:customer-domains")
    def test_get_absolute_url_customer_domains(self):
        url = self.project.get_absolute_url()
        assert (
            url == f"http://{self.organization.slug}.testserver/issues/?project={self.project.id}"
        )


@region_silo_test
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
    def run_test(self, users: Iterable[User], expected_users: Iterable[User]):
        recipients = get_notification_recipients(
            recipients=RpcActor.many_from_object(users),
            type=NotificationSettingEnum.ISSUE_ALERTS,
            project_ids=[self.project.id],
            organization_id=self.project.organization.id,
        )
        actual_recipients = recipients[ExternalProviders.EMAIL]
        expected_recipients = {
            RpcActor.from_orm_user(user, fetch_actor=False) for user in expected_users
        }
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


@region_silo_test
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
