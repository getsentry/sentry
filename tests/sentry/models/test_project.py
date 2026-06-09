from collections.abc import Iterable
from unittest.mock import MagicMock, patch

from sentry.constants import ObjectStatus
from sentry.deletions.models.scheduleddeletion import CellScheduledDeletion
from sentry.deletions.tasks.hybrid_cloud import schedule_hybrid_cloud_foreign_key_jobs_control
from sentry.grouping.grouptype import ErrorGroupType
from sentry.integrations.models.external_issue import ExternalIssue
from sentry.integrations.models.repository_project_path_config import RepositoryProjectPathConfig
from sentry.integrations.types import ExternalProviders
from sentry.models.environment import Environment, EnvironmentProject
from sentry.models.grouplink import GroupLink
from sentry.models.organizationmember import OrganizationMember
from sentry.models.organizationmemberteam import OrganizationMemberTeam
from sentry.models.project import Project
from sentry.models.projectcodeowners import ProjectCodeOwners
from sentry.models.projectownership import ProjectOwnership
from sentry.models.projectrepository import ProjectRepository, ProjectRepositorySource
from sentry.models.projectteam import ProjectTeam
from sentry.models.release import Release
from sentry.models.releaseprojectenvironment import ReleaseProjectEnvironment
from sentry.models.releases.release_project import ReleaseProject
from sentry.models.repository import Repository
from sentry.models.rule import Rule
from sentry.monitors.models import Monitor, MonitorEnvironment, ScheduleType
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
from sentry.workflow_engine.models import (
    Action,
    DataConditionGroup,
    DataConditionGroupAction,
    Detector,
    DetectorWorkflow,
    Workflow,
    WorkflowDataConditionGroup,
)
from sentry.workflow_engine.typings.grouptype import IssueStreamGroupType


class ProjectTest(APITestCase, TestCase):
    def test_member_set_simple(self) -> None:
        user = self.create_user()
        org = self.create_organization(owner=user)
        team = self.create_team(organization=org)
        project = self.create_project(teams=[team])
        member = OrganizationMember.objects.get(user_id=user.id, organization=org)
        OrganizationMemberTeam.objects.create(organizationmember=member, team=team)

        assert list(project.member_set.all()) == [member]

    def test_inactive_global_member(self) -> None:
        user = self.create_user()
        org = self.create_organization(owner=user)
        team = self.create_team(organization=org)
        project = self.create_project(teams=[team])
        OrganizationMember.objects.get(user_id=user.id, organization=org)

        assert list(project.member_set.all()) == []

    def test_get_absolute_url(self) -> None:
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
    def test_get_absolute_url_customer_domains(self) -> None:
        url = self.project.get_absolute_url()
        assert (
            url == f"http://{self.organization.slug}.testserver/issues/?project={self.project.id}"
        )

    def test_get_next_short_id_simple(self) -> None:
        with patch("sentry.models.Counter.increment", return_value=1231):
            assert self.project.next_short_id() == 1231

    def test_next_short_id_increments_by_one_if_no_delta_passed(self) -> None:
        assert self.project.next_short_id() == 1
        assert self.project.next_short_id() == 2

    def test_get_next_short_id_increments_by_delta_value(self) -> None:
        assert self.project.next_short_id() == 1
        assert self.project.next_short_id(delta=2) == 3

    def test_add_team(self) -> None:
        team = self.create_team(organization=self.organization)
        assert self.project.add_team(team)

        teams = self.project.teams.all()
        assert team.id in {t.id for t in teams}

    @patch("sentry.models.project.locks.get")
    def test_lock_is_acquired_when_creating_project(self, mock_lock: MagicMock) -> None:
        # self.organization is cached property, which means it will be created
        # only if it is accessed, so we need to simulate access and all potential mock
        # calls before resetting the mock
        assert self.organization
        # Ensure the mock starts clean before the save operation
        mock_lock.reset_mock()
        Project.objects.create(organization=self.organization)
        assert mock_lock.call_count == 3  # 1 lock for cached org, 2 locks for default detectors

    @patch("sentry.models.project.locks.get")
    def test_lock_is_not_acquired_when_updating_project(self, mock_lock: MagicMock) -> None:
        # self.project is cached property, which means it will be created
        # only if it is accessed, so we need to simulate access and all potential mock
        # calls before resetting the mock
        assert self.project
        # Ensure the mock starts clean before the save operation
        mock_lock.reset_mock()
        self.project.save()
        assert mock_lock.call_count == 0

    def test_remove_team_clears_alerts(self) -> None:
        team = self.create_team(organization=self.organization)
        assert self.project.add_team(team)

        rule = self.create_project_rule(name="issa rule", owner_team_id=team.id)
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

    def test_project_detectors(self) -> None:
        project = self.create_project(create_default_detectors=True)
        assert Detector.objects.filter(project=project, type=ErrorGroupType.slug).count() == 1
        assert Detector.objects.filter(project=project, type=IssueStreamGroupType.slug).count() == 1


class TestProjectTransfer(TestCase):
    def setUp(self) -> None:
        self.from_org = self.create_organization()
        self.team = self.create_team(organization=self.from_org)
        self.to_org = self.create_organization()
        self.project = self.create_project(teams=[self.team])

        self.detector = self.create_detector(project=self.project)
        self.data_source = self.create_data_source(organization=self.from_org)
        self.data_source.detectors.add(self.detector)
        self.workflow = self.create_workflow(organization=self.from_org)
        self.create_detector_workflow(detector=self.detector, workflow=self.workflow)

    def test_transfer_to_organization(self) -> None:
        project_other = self.create_project(teams=[self.team])
        rule = self.create_project_rule(
            name="Golden Rule",
            project=self.project,
            environment_id=Environment.get_or_create(self.project, "production").id,
        )
        environment_from_new = self.create_environment(organization=self.from_org)
        environment_from_existing = self.create_environment(organization=self.from_org)
        environment_to_existing = self.create_environment(
            organization=self.to_org, name=environment_from_existing.name
        )

        monitor = Monitor.objects.create(
            name="test-monitor",
            slug="test-monitor",
            organization_id=self.from_org.id,
            project_id=self.project.id,
            config={"schedule": [1, "month"], "schedule_type": ScheduleType.INTERVAL},
        )

        monitor_also = Monitor.objects.create(
            name="test-monitor-also",
            slug="test-monitor-also",
            organization_id=self.from_org.id,
            project_id=self.project.id,
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
            organization_id=self.from_org.id,
            project_id=project_other.id,
            config={"schedule": [1, "month"], "schedule_type": ScheduleType.INTERVAL},
        )

        monitor_to = Monitor.objects.create(
            name="test-monitor",
            slug="test-monitor",
            organization_id=self.to_org.id,
            project_id=self.create_project(name="other-project").id,
            config={"schedule": [1, "month"], "schedule_type": ScheduleType.INTERVAL},
        )

        self.project.transfer_to(organization=self.to_org)

        self.project = Project.objects.get(id=self.project.id)

        assert self.project.teams.count() == 0
        assert self.project.organization_id == self.to_org.id

        updated_rule = self.project.rule_set.get(label="Golden Rule")
        assert updated_rule.id == rule.id
        assert updated_rule.environment_id != rule.environment_id
        assert (
            updated_rule.environment_id == Environment.get_or_create(self.project, "production").id
        )

        # check to make sure old monitor is scheduled for deletion
        assert CellScheduledDeletion.objects.filter(
            object_id=monitor.id, model_name="Monitor"
        ).exists()

        updated_monitor = Monitor.objects.get(slug="test-monitor-also")
        assert updated_monitor.id == monitor_also.id
        assert updated_monitor.organization_id == self.to_org.id
        assert updated_monitor.project_id == self.project.id
        monitor_env_new.refresh_from_db()
        environment_to_new = Environment.objects.get(id=monitor_env_new.environment_id)
        assert environment_to_new.organization_id == self.to_org.id
        assert environment_to_new.name == environment_from_new.name
        monitor_env_existing.refresh_from_db()
        assert monitor_env_existing.environment_id == environment_to_existing.id

        unmoved_monitor = Monitor.objects.get(slug="test-monitor-other")
        assert unmoved_monitor.id == monitor_other.id
        assert unmoved_monitor.organization_id == self.from_org.id
        assert unmoved_monitor.project_id == project_other.id

        existing_monitor = Monitor.objects.get(id=monitor_to.id)
        assert existing_monitor.id == monitor_to.id
        assert existing_monitor.organization_id == self.to_org.id
        assert existing_monitor.project_id == monitor_to.project_id

    def test_transfer_to_organization_slug_collision(self) -> None:
        # give the project being transferred a slug that collides with an
        # existing project in the target org
        self.project.update(slug="matt")
        self.create_project(slug="matt", organization=self.to_org)

        assert Project.objects.filter(organization=self.to_org).count() == 1

        self.project.transfer_to(organization=self.to_org)

        self.project = Project.objects.get(id=self.project.id)

        assert self.project.teams.count() == 0
        assert self.project.organization_id == self.to_org.id
        assert self.project.slug != "matt"
        assert Project.objects.filter(organization=self.to_org).count() == 2
        assert Project.objects.filter(organization=self.from_org).count() == 0

    def test_transfer_to_organization_releases(self) -> None:
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

        project_before = project_props(self.project)

        environment = Environment.get_or_create(self.project, "production")
        release = Release.get_or_create(project=self.project, version="1.0")

        ReleaseProjectEnvironment.objects.create(
            project=self.project, release=release, environment=environment
        )

        assert Environment.objects.filter(id=environment.id).exists()
        assert Environment.objects.filter(
            organization_id=self.from_org.id, projects=self.project
        ).exists()

        assert EnvironmentProject.objects.filter(
            environment=environment, project=self.project
        ).exists()
        assert ReleaseProjectEnvironment.objects.filter(
            project=self.project, release=release, environment=environment
        ).exists()
        assert ReleaseProject.objects.filter(project=self.project, release=release).exists()

        self.project.transfer_to(organization=self.to_org)

        self.project = Project.objects.get(id=self.project.id)
        project_after = project_props(self.project)

        assert project_before == project_after
        assert self.project.teams.count() == 0
        assert self.project.organization_id == self.to_org.id

        assert Environment.objects.filter(id=environment.id).exists()
        assert not EnvironmentProject.objects.filter(
            environment=environment, project=self.project
        ).exists()
        assert not ReleaseProjectEnvironment.objects.filter(
            project=self.project, release=release, environment=environment
        ).exists()
        assert not ReleaseProject.objects.filter(project=self.project, release=release).exists()

    def test_delete_on_transfer_repository_project_path_configs(self) -> None:
        with assume_test_silo_mode(SiloMode.CONTROL):
            integration, org_integration = self.create_provider_integration_for(
                self.from_org, self.user, provider="github"
            )

        repository = Repository.objects.create(
            organization_id=self.from_org.id,
            name="example-repo",
            integration_id=integration.id,
        )

        project_repo, _ = ProjectRepository.objects.get_or_create(
            project=self.project,
            repository=repository,
            defaults={"source": ProjectRepositorySource.MANUAL},
        )
        repository_project_path_config = RepositoryProjectPathConfig.objects.create(
            organization_integration_id=org_integration.id,
            organization_id=self.from_org.id,
            integration_id=integration.id,
            stack_root="/app",
            source_root="/src",
            default_branch="main",
            project_repository=project_repo,
        )

        ProjectCodeOwners.objects.create(
            project=self.project,
            repository_project_path_config=repository_project_path_config,
            raw="*.py @getsentry/test-team",
        )

        self.project.transfer_to(organization=self.to_org)

        assert (
            RepositoryProjectPathConfig.objects.filter(organization_id=self.from_org.id).count()
            == 0
        )
        assert (
            RepositoryProjectPathConfig.objects.filter(organization_id=self.to_org.id).count() == 0
        )

        assert (
            RepositoryProjectPathConfig.objects.filter(
                project_repository__project_id=self.project.id
            ).count()
            == 0
        )

        assert ProjectCodeOwners.objects.filter(project_id=self.project.id).count() == 0

    def test_transfer_to_organization_alert_rules(self) -> None:
        from_user = self.create_user()
        self.create_member(user=from_user, role="member", organization=self.from_org)
        to_team = self.create_team(organization=self.to_org)
        to_user = self.create_user()
        self.create_member(user=to_user, role="member", organization=self.to_org)

        self.project = self.create_project(teams=[self.team])
        environment = Environment.get_or_create(self.project, "production")

        # should lose their owners
        alert_rule = self.create_alert_rule(
            organization=self.organization,
            projects=[self.project],
            owner=Actor.from_identifier(f"team:{self.team.id}"),
            environment=environment,
        )
        snuba_query = SnubaQuery.objects.filter(id=alert_rule.snuba_query_id).get()
        rule1 = self.create_project_rule(
            name="another test rule", project=self.project, owner_team=self.team
        )
        rule2 = self.create_project_rule(
            name="rule4", project=self.project, owner_user_id=from_user.id
        )

        # should keep their owners
        rule3 = self.create_project_rule(name="rule2", project=self.project, owner_team=to_team)
        rule4 = self.create_project_rule(
            name="rule3", project=self.project, owner_user_id=to_user.id
        )

        assert EnvironmentProject.objects.count() == 1
        assert snuba_query.environment is not None
        assert snuba_query.environment.id == environment.id

        self.project.transfer_to(organization=self.to_org)

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
        assert alert_rule.organization_id == self.to_org.id
        assert alert_rule.user_id is None
        assert alert_rule.team_id is None

        for rule in (rule1, rule2):
            assert rule.owner_user_id is None
            assert rule.owner_team_id is None

        assert rule3.owner_user_id is None
        assert rule3.owner_team_id

        assert rule4.owner_user_id
        assert rule4.owner_team_id is None

    def test_transfer_to_organization_external_issues(self) -> None:
        group = self.create_group(project=self.project)
        other_project = self.create_project(organization=self.from_org)
        other_group = self.create_group(project=other_project)

        self.integration = self.create_integration(
            organization=self.organization,
            provider="jira",
            name="Jira",
            external_id="jira:1",
        )
        ext_issue = ExternalIssue.objects.create(
            organization_id=self.from_org.id,
            integration_id=self.integration.id,
            key="123",
        )
        other_ext_issue = ExternalIssue.objects.create(
            organization_id=self.from_org.id,
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

        self.project.transfer_to(organization=self.to_org)
        self.project.refresh_from_db()
        other_project.refresh_from_db()
        ext_issue.refresh_from_db()
        other_ext_issue.refresh_from_db()
        group_link.refresh_from_db()
        other_group_link.refresh_from_db()

        assert self.project.organization_id == self.to_org.id
        assert ext_issue.organization_id == self.to_org.id
        assert group_link.project_id == self.project.id

        assert other_project.organization_id == self.from_org.id
        assert other_ext_issue.organization_id == self.from_org.id
        assert other_group_link.project_id == other_project.id

    def test_transfer_to_organization_with_metric_issue_detector_and_workflow(self) -> None:
        self.project.transfer_to(organization=self.to_org)

        self.project.refresh_from_db()
        self.detector.refresh_from_db()
        self.data_source.refresh_from_db()
        self.workflow.refresh_from_db()

        assert self.project.organization_id == self.to_org.id
        assert self.detector.project_id == self.project.id
        assert self.data_source.organization_id == self.to_org.id
        assert self.workflow.organization_id == self.to_org.id
        assert DetectorWorkflow.objects.filter(
            detector=self.detector, workflow=self.workflow
        ).exists()

    def test_transfer_to_organization_with_workflow_data_condition_groups(self) -> None:
        with assume_test_silo_mode(SiloMode.CONTROL):
            from_integration = self.create_integration(
                organization=self.from_org, external_id="from-slack", provider="slack"
            )
            to_integration = self.create_integration(
                organization=self.to_org, external_id="to-slack", provider="slack"
            )

        condition_group = self.create_data_condition_group(organization=self.from_org)
        self.create_workflow_data_condition_group(
            workflow=self.workflow, condition_group=condition_group
        )
        action = self.create_action(
            integration_id=from_integration.id,
            status=ObjectStatus.ACTIVE,
        )
        self.create_data_condition_group_action(action=action, condition_group=condition_group)

        self.project.transfer_to(organization=self.to_org)

        self.project.refresh_from_db()
        self.detector.refresh_from_db()
        self.workflow.refresh_from_db()
        condition_group.refresh_from_db()

        assert self.project.organization_id == self.to_org.id
        assert self.detector.project_id == self.project.id
        assert self.workflow.organization_id == self.to_org.id
        assert condition_group.organization_id == self.to_org.id
        wdcg = condition_group.workflowdataconditiongroup_set.first()
        assert wdcg is not None
        assert wdcg.workflow_id == self.workflow.id

        # The workflow moved in place; the destination org has a matching active Slack integration,
        # so the same action is remapped to it and stays active.
        action.refresh_from_db()
        assert action.integration_id == to_integration.id
        assert action.status == ObjectStatus.ACTIVE

    def test_transfer_to_organization_clones_shared_workflows(self) -> None:
        project_a = self.create_project(teams=[self.team], name="Project A")
        project_b = self.create_project(
            teams=[self.team], organization=self.from_org, name="Project B"
        )

        detector_a = self.create_detector(project=project_a)
        detector_b = self.create_detector(project=project_b)

        # Shared across both projects' detectors, so it must be cloned (not moved) on transfer.
        # The owner belongs to the old org, so the clone must drop it.
        shared_workflow = self.create_workflow(
            organization=self.from_org, name="Shared Workflow", owner_team_id=self.team.id
        )
        self.create_detector_workflow(detector=detector_a, workflow=shared_workflow)
        self.create_detector_workflow(detector=detector_b, workflow=shared_workflow)

        exclusive_workflow = self.create_workflow(
            organization=self.from_org, name="Exclusive Workflow"
        )
        self.create_detector_workflow(detector=detector_a, workflow=exclusive_workflow)

        shared_dcg = self.create_data_condition_group(organization=self.from_org)
        self.create_workflow_data_condition_group(
            workflow=shared_workflow, condition_group=shared_dcg
        )

        exclusive_dcg = self.create_data_condition_group(organization=self.from_org)
        self.create_workflow_data_condition_group(
            workflow=exclusive_workflow, condition_group=exclusive_dcg
        )

        project_a.transfer_to(organization=self.to_org)

        project_a.refresh_from_db()
        project_b.refresh_from_db()
        detector_a.refresh_from_db()
        detector_b.refresh_from_db()
        shared_workflow.refresh_from_db()
        exclusive_workflow.refresh_from_db()
        shared_dcg.refresh_from_db()
        exclusive_dcg.refresh_from_db()

        assert project_a.organization_id == self.to_org.id
        assert project_b.organization_id == self.from_org.id
        assert detector_a.project_id == project_a.id
        assert detector_b.project_id == project_b.id

        # The exclusive workflow is moved as-is.
        assert exclusive_workflow.organization_id == self.to_org.id
        assert exclusive_dcg.organization_id == self.to_org.id
        assert DetectorWorkflow.objects.filter(
            detector=detector_a, workflow=exclusive_workflow
        ).exists()

        # The original shared workflow stays behind for project_b, no longer linked to detector_a,
        # and keeps its owner.
        assert shared_workflow.organization_id == self.from_org.id
        assert shared_workflow.owner_team_id == self.team.id
        assert shared_dcg.organization_id == self.from_org.id
        assert DetectorWorkflow.objects.filter(
            detector=detector_b, workflow=shared_workflow
        ).exists()
        assert not DetectorWorkflow.objects.filter(
            detector=detector_a, workflow=shared_workflow
        ).exists()

        # detector_a is re-pointed onto a clone of the shared workflow that lives in the new org.
        clone = Workflow.objects.get(organization=self.to_org, name="Shared Workflow")
        assert clone.id != shared_workflow.id
        assert DetectorWorkflow.objects.filter(detector=detector_a, workflow=clone).exists()

        # The owner is dropped on the clone since it belongs to the old org.
        assert clone.owner_team_id is None
        assert clone.owner_user_id is None

        # The clone has its own condition group in the new org; the original is untouched.
        clone_condition_group_ids = WorkflowDataConditionGroup.objects.filter(
            workflow=clone
        ).values_list("condition_group_id", flat=True)
        assert shared_dcg.id not in clone_condition_group_ids
        assert (
            DataConditionGroup.objects.filter(
                id__in=clone_condition_group_ids, organization=self.to_org
            ).count()
            == 1
        )

    def test_transfer_to_organization_clones_shared_workflow_actions(self) -> None:
        project_a = self.create_project(teams=[self.team], name="Project A")
        project_b = self.create_project(
            teams=[self.team], organization=self.from_org, name="Project B"
        )

        detector_a = self.create_detector(project=project_a)
        detector_b = self.create_detector(project=project_b)

        shared_workflow = self.create_workflow(organization=self.from_org, name="Shared Workflow")
        self.create_detector_workflow(detector=detector_a, workflow=shared_workflow)
        self.create_detector_workflow(detector=detector_b, workflow=shared_workflow)

        shared_dcg = self.create_data_condition_group(organization=self.from_org)
        self.create_workflow_data_condition_group(
            workflow=shared_workflow, condition_group=shared_dcg
        )
        action = self.create_action()
        self.create_data_condition_group_action(action=action, condition_group=shared_dcg)

        project_a.transfer_to(organization=self.to_org)

        # The clone gets its own Action copy; the original Action is untouched and still attached
        # to the workflow that stays behind.
        clone = Workflow.objects.get(organization=self.to_org, name="Shared Workflow")
        clone_condition_group_ids = WorkflowDataConditionGroup.objects.filter(
            workflow=clone
        ).values_list("condition_group_id", flat=True)
        clone_actions = Action.objects.filter(
            dataconditiongroupaction__condition_group_id__in=clone_condition_group_ids
        )
        assert clone_actions.count() == 1
        clone_action = clone_actions.get()
        assert clone_action.id != action.id
        assert clone_action.type == action.type
        assert clone_action.data == action.data
        assert clone_action.config == action.config

        assert DataConditionGroupAction.objects.filter(
            condition_group=shared_dcg, action=action
        ).exists()

    def test_transfer_to_organization_remaps_integration_action_to_destination_integration(
        self,
    ) -> None:
        with assume_test_silo_mode(SiloMode.CONTROL):
            from_integration = self.create_integration(
                organization=self.from_org, external_id="from-slack", provider="slack"
            )
            to_integration = self.create_integration(
                organization=self.to_org, external_id="to-slack", provider="slack"
            )

        project_a = self.create_project(teams=[self.team], name="Project A")
        project_b = self.create_project(
            teams=[self.team], organization=self.from_org, name="Project B"
        )

        detector_a = self.create_detector(project=project_a)
        detector_b = self.create_detector(project=project_b)

        shared_workflow = self.create_workflow(organization=self.from_org, name="Shared Workflow")
        self.create_detector_workflow(detector=detector_a, workflow=shared_workflow)
        self.create_detector_workflow(detector=detector_b, workflow=shared_workflow)

        shared_dcg = self.create_data_condition_group(organization=self.from_org)
        self.create_workflow_data_condition_group(
            workflow=shared_workflow, condition_group=shared_dcg
        )
        action = self.create_action(
            integration_id=from_integration.id,
            status=ObjectStatus.ACTIVE,
        )
        self.create_data_condition_group_action(action=action, condition_group=shared_dcg)

        project_a.transfer_to(organization=self.to_org)

        # The destination org has a matching active Slack integration, so the cloned action is
        # remapped to it and stays active.
        clone = Workflow.objects.get(organization=self.to_org, name="Shared Workflow")
        clone_condition_group_ids = WorkflowDataConditionGroup.objects.filter(
            workflow=clone
        ).values_list("condition_group_id", flat=True)
        clone_action = Action.objects.get(
            dataconditiongroupaction__condition_group_id__in=clone_condition_group_ids
        )
        assert clone_action.id != action.id
        assert clone_action.integration_id == to_integration.id
        assert clone_action.status == ObjectStatus.ACTIVE

        # The original action stays behind untouched.
        action.refresh_from_db()
        assert action.integration_id == from_integration.id
        assert action.status == ObjectStatus.ACTIVE

    def test_transfer_to_organization_disables_integration_action_without_destination_integration(
        self,
    ) -> None:
        with assume_test_silo_mode(SiloMode.CONTROL):
            from_integration = self.create_integration(
                organization=self.from_org, external_id="from-slack", provider="slack"
            )

        project_a = self.create_project(teams=[self.team], name="Project A")
        project_b = self.create_project(
            teams=[self.team], organization=self.from_org, name="Project B"
        )

        detector_a = self.create_detector(project=project_a)
        detector_b = self.create_detector(project=project_b)

        shared_workflow = self.create_workflow(organization=self.from_org, name="Shared Workflow")
        self.create_detector_workflow(detector=detector_a, workflow=shared_workflow)
        self.create_detector_workflow(detector=detector_b, workflow=shared_workflow)

        shared_dcg = self.create_data_condition_group(organization=self.from_org)
        self.create_workflow_data_condition_group(
            workflow=shared_workflow, condition_group=shared_dcg
        )
        action = self.create_action(
            integration_id=from_integration.id,
            status=ObjectStatus.ACTIVE,
        )
        self.create_data_condition_group_action(action=action, condition_group=shared_dcg)

        project_a.transfer_to(organization=self.to_org)

        # The destination org has no matching integration, so the cloned action keeps the original
        # integration_id but is disabled.
        clone = Workflow.objects.get(organization=self.to_org, name="Shared Workflow")
        clone_condition_group_ids = WorkflowDataConditionGroup.objects.filter(
            workflow=clone
        ).values_list("condition_group_id", flat=True)
        clone_action = Action.objects.get(
            dataconditiongroupaction__condition_group_id__in=clone_condition_group_ids
        )
        assert clone_action.id != action.id
        assert clone_action.integration_id == from_integration.id
        assert clone_action.status == ObjectStatus.DISABLED

        # The original action stays behind untouched.
        action.refresh_from_db()
        assert action.status == ObjectStatus.ACTIVE

    def test_transfer_to_organization_disables_integration_action_with_multiple_destination_integrations(
        self,
    ) -> None:
        with assume_test_silo_mode(SiloMode.CONTROL):
            from_integration = self.create_integration(
                organization=self.from_org, external_id="from-slack", provider="slack"
            )
            self.create_integration(
                organization=self.to_org, external_id="to-slack-1", provider="slack"
            )
            self.create_integration(
                organization=self.to_org, external_id="to-slack-2", provider="slack"
            )

        project_a = self.create_project(teams=[self.team], name="Project A")
        project_b = self.create_project(
            teams=[self.team], organization=self.from_org, name="Project B"
        )

        detector_a = self.create_detector(project=project_a)
        detector_b = self.create_detector(project=project_b)

        shared_workflow = self.create_workflow(organization=self.from_org, name="Shared Workflow")
        self.create_detector_workflow(detector=detector_a, workflow=shared_workflow)
        self.create_detector_workflow(detector=detector_b, workflow=shared_workflow)

        shared_dcg = self.create_data_condition_group(organization=self.from_org)
        self.create_workflow_data_condition_group(
            workflow=shared_workflow, condition_group=shared_dcg
        )
        action = self.create_action(
            integration_id=from_integration.id,
            status=ObjectStatus.ACTIVE,
        )
        self.create_data_condition_group_action(action=action, condition_group=shared_dcg)

        project_a.transfer_to(organization=self.to_org)

        # The destination org has multiple active Slack integrations, so we can't tell which one
        # the action meant; the cloned action keeps the original integration_id but is disabled.
        clone = Workflow.objects.get(organization=self.to_org, name="Shared Workflow")
        clone_condition_group_ids = WorkflowDataConditionGroup.objects.filter(
            workflow=clone
        ).values_list("condition_group_id", flat=True)
        clone_action = Action.objects.get(
            dataconditiongroupaction__condition_group_id__in=clone_condition_group_ids
        )
        assert clone_action.id != action.id
        assert clone_action.integration_id == from_integration.id
        assert clone_action.status == ObjectStatus.DISABLED

        # The original action stays behind untouched.
        action.refresh_from_db()
        assert action.status == ObjectStatus.ACTIVE

    def test_transfer_to_organization_clones_shared_workflows_is_idempotent(self) -> None:
        project_a = self.create_project(teams=[self.team], name="Project A")
        project_b = self.create_project(
            teams=[self.team], organization=self.from_org, name="Project B"
        )

        detector_a = self.create_detector(project=project_a)
        detector_b = self.create_detector(project=project_b)

        shared_workflow = self.create_workflow(organization=self.from_org, name="Shared Workflow")
        self.create_detector_workflow(detector=detector_a, workflow=shared_workflow)
        self.create_detector_workflow(detector=detector_b, workflow=shared_workflow)

        shared_dcg = self.create_data_condition_group(organization=self.from_org)
        self.create_workflow_data_condition_group(
            workflow=shared_workflow, condition_group=shared_dcg
        )

        project_a.transfer_to(organization=self.to_org)

        clone = Workflow.objects.get(organization=self.to_org, name="Shared Workflow")
        clone_condition_group_ids = list(
            WorkflowDataConditionGroup.objects.filter(workflow=clone).values_list(
                "condition_group_id", flat=True
            )
        )

        # After the first transfer the clone is exclusive to project_a's detector, so a second
        # transfer should move it as-is without producing another clone or new condition groups.
        project_a.transfer_to(organization=self.to_org)

        assert (
            Workflow.objects.filter(organization=self.to_org, name="Shared Workflow").count() == 1
        )
        clone.refresh_from_db()
        assert clone.organization_id == self.to_org.id
        assert DetectorWorkflow.objects.filter(detector=detector_a, workflow=clone).exists()
        assert (
            list(
                WorkflowDataConditionGroup.objects.filter(workflow=clone).values_list(
                    "condition_group_id", flat=True
                )
            )
            == clone_condition_group_ids
        )

    def test_transfer_to_organization_with_detector_workflow_condition_group(self) -> None:
        workflow_condition_group = self.create_data_condition_group(organization=self.from_org)
        self.detector.workflow_condition_group = workflow_condition_group
        self.detector.save()

        self.project.transfer_to(organization=self.to_org)

        self.project.refresh_from_db()
        self.detector.refresh_from_db()
        workflow_condition_group.refresh_from_db()

        assert self.project.organization_id == self.to_org.id
        assert self.detector.project_id == self.project.id
        assert workflow_condition_group.organization_id == self.to_org.id
        assert self.detector.workflow_condition_group_id == workflow_condition_group.id

    def test_transfer_to_organization_with_workflow_when_condition_groups(self) -> None:
        detector = self.create_detector(project=self.project)
        when_condition_group = self.create_data_condition_group(organization=self.from_org)
        workflow = self.create_workflow(
            organization=self.from_org, when_condition_group=when_condition_group
        )
        self.create_detector_workflow(detector=detector, workflow=workflow)

        self.project.transfer_to(organization=self.to_org)

        self.project.refresh_from_db()
        detector.refresh_from_db()
        workflow.refresh_from_db()
        when_condition_group.refresh_from_db()

        assert self.project.organization_id == self.to_org.id
        assert detector.project_id == self.project.id
        assert workflow.organization_id == self.to_org.id
        assert when_condition_group.organization_id == self.to_org.id

    def test_transfer_to_organization_updates_workflow_environment(self) -> None:
        env = self.create_environment(project=self.project, name="production")
        self.workflow.update(environment_id=env.id)
        self.project.transfer_to(organization=self.to_org)

        self.workflow.refresh_from_db()

        assert self.workflow.organization_id == self.to_org.id
        assert self.workflow.environment_id is not None
        assert self.workflow.environment_id != env.id
        new_env = Environment.objects.get(id=self.workflow.environment_id)
        assert new_env.organization_id == self.to_org.id
        assert new_env.name == "production"

    def test_transfer_to_organization_nulls_detector_owner(self) -> None:
        from_user = self.create_user()
        from_org = self.create_organization(owner=from_user)
        team = self.create_team(organization=from_org)
        project = self.create_project(teams=[team])

        to_user = self.create_user()
        to_org = self.create_organization(owner=to_user)

        detector = self.create_detector(project=project, owner_team_id=team.id, owner_user_id=None)

        project.transfer_to(organization=to_org)

        detector.refresh_from_db()

        assert detector.owner_team_id is None
        assert detector.owner_user_id is None


class CopyProjectSettingsTest(TestCase):
    def setUp(self) -> None:
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

        self.create_project_rule(name="rule1", project=self.other_project)
        self.create_project_rule(name="rule2", project=self.other_project)
        self.create_project_rule(name="rule3", project=self.other_project)
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

    def test_simple(self) -> None:
        project = self.create_project(fire_project_created=True)

        assert project.copy_settings_from(self.other_project.id)
        self.assert_settings_copied(project)
        self.assert_other_project_settings_not_changed()

    def test_copy_with_previous_settings(self) -> None:
        project = self.create_project(fire_project_created=True)
        project.update_option("sentry:resolve_age", 200)
        ProjectTeam.objects.create(team=self.create_team(), project=project)
        self.create_environment(project=project)
        Rule.objects.filter(project_id=project.id).order_by("id")[0]

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

    def test(self) -> None:
        self.run_test([self.user], {self.user})

    def test_global_enabled(self) -> None:
        user = self.create_user()
        self.run_test({user}, {user})

    def test_global_disabled(self) -> None:
        user = self.create_user()
        NotificationSettingOption.objects.create(
            user_id=user.id,
            scope_type="user",
            scope_identifier=user.id,
            type="alerts",
            value="never",
        )
        self.run_test({user}, set())

    def test_project_enabled(self) -> None:
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

    def test_project_disabled(self) -> None:
        user = self.create_user()
        NotificationSettingOption.objects.create(
            user_id=user.id,
            scope_type="project",
            scope_identifier=self.project.id,
            type="alerts",
            value="never",
        )
        self.run_test({user}, set())

    def test_mixed(self) -> None:
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
    def test_hybrid_cloud_deletion(self) -> None:
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
