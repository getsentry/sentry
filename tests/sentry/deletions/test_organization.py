from uuid import uuid4

from sentry.deletions.tasks.scheduled import run_scheduled_deletions
from sentry.discover.models import DiscoverSavedQuery, DiscoverSavedQueryProject
from sentry.incidents.models.alert_rule import AlertRule, AlertRuleStatus
from sentry.integrations.models.external_issue import ExternalIssue
from sentry.models.commit import Commit
from sentry.models.commitauthor import CommitAuthor
from sentry.models.dashboard import Dashboard
from sentry.models.dashboard_widget import (
    DashboardWidget,
    DashboardWidgetQuery,
    DashboardWidgetTypes,
)
from sentry.models.environment import Environment, EnvironmentProject
from sentry.models.group import Group
from sentry.models.organization import Organization, OrganizationStatus
from sentry.models.organizationmapping import OrganizationMapping
from sentry.models.organizationmember import OrganizationMember
from sentry.models.organizationmembermapping import OrganizationMemberMapping
from sentry.models.pullrequest import PullRequest
from sentry.models.release import Release
from sentry.models.releasecommit import ReleaseCommit
from sentry.models.releaseenvironment import ReleaseEnvironment
from sentry.models.repository import Repository
from sentry.silo.base import SiloMode
from sentry.snuba.models import SnubaQuery
from sentry.testutils.cases import TransactionTestCase
from sentry.testutils.hybrid_cloud import HybridCloudTestMixin
from sentry.testutils.outbox import outbox_runner
from sentry.testutils.silo import assume_test_silo_mode
from sentry.types.actor import Actor


class DeleteOrganizationTest(TransactionTestCase, HybridCloudTestMixin):
    def test_simple(self):
        org_owner = self.create_user()
        org = self.create_organization(name="test", owner=org_owner)
        with assume_test_silo_mode(SiloMode.CONTROL):
            org_mapping = OrganizationMapping.objects.get(organization_id=org.id)
        org_member = OrganizationMember.objects.get(organization_id=org.id, user_id=org_owner.id)
        self.assert_org_member_mapping(org_member=org_member)

        org_owner2 = self.create_user()
        org2 = self.create_organization(name="test2", owner=org_owner2)
        with assume_test_silo_mode(SiloMode.CONTROL):
            org_mapping2 = OrganizationMapping.objects.get(organization_id=org2.id)

        self.create_team(organization=org, name="test1")
        self.create_team(organization=org, name="test2")
        release = Release.objects.create(version="a" * 32, organization_id=org.id)
        repo = Repository.objects.create(organization_id=org.id, name=org.name, provider="dummy")
        commit_author = CommitAuthor.objects.create(
            organization_id=org.id, name="foo", email="foo@example.com"
        )
        commit = Commit.objects.create(
            repository_id=repo.id, organization_id=org.id, author=commit_author, key="a" * 40
        )
        pull_request = PullRequest.objects.create(
            repository_id=repo.id, organization_id=org.id, author=commit_author, key="b" * 40
        )
        ReleaseCommit.objects.create(
            organization_id=org.id, release=release, commit=commit, order=0
        )

        env = Environment.objects.create(organization_id=org.id, name="foo")
        release_env = ReleaseEnvironment.objects.create(
            organization_id=org.id, project_id=4, release_id=release.id, environment_id=env.id
        )

        external_issue = ExternalIssue.objects.create(
            organization_id=org.id, integration_id=5, key="12345"
        )

        dashboard = Dashboard.objects.create(
            organization_id=org.id, title="The Dashboard", created_by_id=self.user.id
        )
        widget_1 = DashboardWidget.objects.create(
            dashboard=dashboard,
            order=1,
            title="Widget 1",
            display_type=0,
            widget_type=DashboardWidgetTypes.DISCOVER,
        )
        widget_2 = DashboardWidget.objects.create(
            dashboard=dashboard,
            order=2,
            title="Widget 2",
            display_type=5,
            widget_type=DashboardWidgetTypes.DISCOVER,
        )
        widget_1_data = DashboardWidgetQuery.objects.create(
            widget=widget_1, order=1, name="Incoming data"
        )
        widget_2_data_1 = DashboardWidgetQuery.objects.create(
            widget=widget_2, order=1, name="Incoming data"
        )
        widget_2_data_2 = DashboardWidgetQuery.objects.create(
            widget=widget_2, order=2, name="Outgoing data"
        )
        org.update(status=OrganizationStatus.PENDING_DELETION)

        self.ScheduledDeletion.schedule(instance=org, days=0)

        with self.tasks(), outbox_runner():
            run_scheduled_deletions()

        assert Organization.objects.filter(id=org2.id).exists()
        with assume_test_silo_mode(SiloMode.CONTROL):
            assert OrganizationMapping.objects.filter(id=org_mapping2.id).exists()
            assert OrganizationMemberMapping.objects.filter(organization_id=org2.id).exists()

        assert not Organization.objects.filter(id=org.id).exists()
        with assume_test_silo_mode(SiloMode.CONTROL):
            assert not OrganizationMapping.objects.filter(id=org_mapping.id).exists()
            assert not OrganizationMemberMapping.objects.filter(organization_id=org.id).exists()
        assert not Environment.objects.filter(id=env.id).exists()
        assert not ReleaseEnvironment.objects.filter(id=release_env.id).exists()
        assert not Repository.objects.filter(id=repo.id).exists()
        assert not ReleaseCommit.objects.filter(organization_id=org.id).exists()
        assert not Release.objects.filter(organization_id=org.id).exists()
        assert not CommitAuthor.objects.filter(id=commit_author.id).exists()
        assert not Commit.objects.filter(id=commit.id).exists()
        assert not PullRequest.objects.filter(id=pull_request.id).exists()
        assert not ExternalIssue.objects.filter(id=external_issue.id).exists()
        assert not Dashboard.objects.filter(id=dashboard.id).exists()
        assert not DashboardWidget.objects.filter(id__in=[widget_1.id, widget_2.id]).exists()
        assert not DashboardWidgetQuery.objects.filter(
            id__in=[widget_1_data.id, widget_2_data_1.id, widget_2_data_2.id]
        ).exists()

    def test_no_delete_visible(self):
        org = self.create_organization(name="test")
        release = Release.objects.create(version="a" * 32, organization_id=org.id)

        deletion = self.ScheduledDeletion.schedule(instance=org, days=0)
        assert org.status == OrganizationStatus.ACTIVE

        with self.tasks():
            run_scheduled_deletions()

        assert Organization.objects.filter(id=org.id).exists()
        assert Release.objects.filter(id=release.id).exists()
        assert not self.ScheduledDeletion.objects.filter(id=deletion.id).exists()

    def test_large_child_relation_deletion(self):
        org = self.create_organization(name="test")
        self.create_team(organization=org, name="test1")
        repo = Repository.objects.create(organization_id=org.id, name=org.name, provider="dummy")
        author_bob = CommitAuthor.objects.create(
            organization_id=org.id, name="bob", email="bob@example.com"
        )
        author_sally = CommitAuthor.objects.create(
            organization_id=org.id, name="sally", email="sally@example.com"
        )
        # Make >100 commits so we can ensure that all commits are removed before authors are.
        for i in range(0, 150):
            author = author_bob if i % 2 == 0 else author_sally
            Commit.objects.create(
                repository_id=repo.id, organization_id=org.id, author=author, key=uuid4().hex
            )

        org.update(status=OrganizationStatus.PENDING_DELETION)
        self.ScheduledDeletion.schedule(instance=org, days=0)

        with self.tasks():
            run_scheduled_deletions()

        assert not Organization.objects.filter(id=org.id).exists()
        assert not Commit.objects.filter(organization_id=org.id).exists()
        assert not CommitAuthor.objects.filter(organization_id=org.id).exists()

    def test_group_first_release(self):
        org = self.create_organization(name="test")
        project = self.create_project(organization=org)
        release = self.create_release(project=project, user=self.user, version="1.2.3")
        group = Group.objects.create(project=project, first_release=release)

        # Simulate the project being deleted but the deletion crashing.
        project.delete()

        org.update(status=OrganizationStatus.PENDING_DELETION)
        self.ScheduledDeletion.schedule(instance=org, days=0)

        with self.tasks():
            run_scheduled_deletions()

        assert not Group.objects.filter(id=group.id).exists()
        assert not Organization.objects.filter(id=org.id).exists()

    def test_orphan_commits(self):
        # We have had a few orgs get into a state where they have commits
        # but no repositories. Ensure that we can proceed.
        org = self.create_organization(name="test")

        repo = Repository.objects.create(organization_id=org.id, name=org.name, provider="dummy")
        author = CommitAuthor.objects.create(
            organization_id=org.id, name="foo", email="foo@example.com"
        )
        commit = Commit.objects.create(
            repository_id=repo.id, organization_id=org.id, author=author, key="a" * 40
        )

        # Simulate the project being deleted but the deletion crashing.
        repo.delete()

        org.update(status=OrganizationStatus.PENDING_DELETION)
        self.ScheduledDeletion.schedule(instance=org, days=0)

        with self.tasks():
            run_scheduled_deletions()

        assert not Organization.objects.filter(id=org.id).exists()
        assert not Commit.objects.filter(id=commit.id).exists()
        assert not CommitAuthor.objects.filter(id=author.id).exists()

    def test_alert_rule(self):
        org = self.create_organization(name="test", owner=self.user)
        self.create_team(organization=org, name="test1")

        env = Environment.objects.create(organization_id=org.id, name="foo")
        snuba_query = SnubaQuery.objects.create(
            type=SnubaQuery.Type.ERROR.value,
            dataset="events",
            aggregate="count()",
            time_window=60,
            resolution=60,
            environment=env,
        )
        alert_rule = AlertRule.objects.create(
            organization=org,
            name="rule with environment",
            threshold_period=1,
            snuba_query=snuba_query,
            # This status is hidden from the default finder.
            status=AlertRuleStatus.SNAPSHOT.value,
        )

        org.update(status=OrganizationStatus.PENDING_DELETION)
        self.ScheduledDeletion.schedule(instance=org, days=0)

        with self.tasks():
            run_scheduled_deletions()

        assert not Organization.objects.filter(id=org.id).exists()
        assert not Environment.objects.filter(id=env.id).exists()
        assert not AlertRule.objects.filter(id=alert_rule.id).exists()
        assert not SnubaQuery.objects.filter(id=snuba_query.id).exists()

    def test_discover_query_cleanup(self):
        org = self.create_organization(name="test", owner=self.user)
        self.create_team(organization=org, name="test1")

        other = self.create_organization(name="other", owner=self.user)
        other_project = self.create_project(organization=other, name="other project")

        query = DiscoverSavedQuery.objects.create(organization=org, name="test query", query={})
        # Make a cross-org project reference. This can happen when an account was
        # merged in the past and we didn't update the discover queries.
        query_project = DiscoverSavedQueryProject.objects.create(
            discover_saved_query=query, project=other_project
        )

        org.update(status=OrganizationStatus.PENDING_DELETION)
        self.ScheduledDeletion.schedule(instance=org, days=0)

        with self.tasks():
            run_scheduled_deletions()

        assert not Organization.objects.filter(id=org.id).exists()
        assert not DiscoverSavedQuery.objects.filter(id=query.id).exists()
        assert not DiscoverSavedQueryProject.objects.filter(id=query_project.id).exists()

    def test_delete_org_simple(self):
        name_filter = {"name": "test_delete_org_simple"}
        org = self.create_organization(**name_filter)

        assert Organization.objects.filter(**name_filter).count() == 1
        assert self.ScheduledDeletion.objects.count() == 0

        org.update(status=OrganizationStatus.PENDING_DELETION)
        self.ScheduledDeletion.schedule(instance=org, days=0)

        with self.tasks():
            run_scheduled_deletions()

        assert Organization.objects.filter(**name_filter).count() == 0

    def test_delete_org_after_project_transfer(self):
        from_org = self.create_organization(name="from_org")
        from_user = self.create_user()
        self.create_member(user=from_user, role="member", organization=from_org)
        from_team = self.create_team(organization=from_org)

        to_org = self.create_organization(name="to_org")
        self.create_team(organization=to_org)
        to_user = self.create_user()
        self.create_member(user=to_user, role="member", organization=to_org)

        project = self.create_project(teams=[from_team])
        environment = Environment.get_or_create(project, "production")
        staging_environment = Environment.get_or_create(project, "staging")

        project_rule = self.create_project_rule(project=project)
        project_rule.update(environment_id=staging_environment.id)

        alert_rule = self.create_alert_rule(
            organization=from_org,
            projects=[project],
            owner=Actor.from_identifier(f"team:{from_team.id}"),
            environment=environment,
        )

        project.transfer_to(organization=to_org)
        assert project.organization.id is to_org.id

        alert_rule.refresh_from_db()
        assert AlertRule.objects.fetch_for_project(project).count() == 1
        assert alert_rule.snuba_query is not None
        assert alert_rule.snuba_query.environment is not None
        assert alert_rule.snuba_query.environment.id != environment.id
        assert (
            alert_rule.snuba_query.environment.name
            == Environment.objects.filter(organization_id=to_org.id, name=environment.name)
            .get()
            .name
        )
        assert EnvironmentProject.objects.filter(project=project).count() == 2
        assert (
            Environment.objects.filter(organization_id=from_org.id, name=environment.name).get().id
            == environment.id
        )
        assert (
            Environment.objects.filter(organization_id=to_org.id, name=environment.name).get().id
            != environment.id
        )
        assert (
            Environment.objects.filter(organization_id=from_org.id, name=staging_environment.name)
            .get()
            .id
            == project_rule.environment_id
        )
        assert (
            Environment.objects.filter(organization_id=to_org.id, name=staging_environment.name)
            .get()
            .id
            != project_rule.environment_id
        )

        from_org.update(status=OrganizationStatus.PENDING_DELETION)
        self.ScheduledDeletion.schedule(instance=from_org, days=0)

        with self.tasks():
            run_scheduled_deletions()

        assert not Organization.objects.filter(name=from_org.name).exists()
        assert Organization.objects.filter(name=to_org.name).exists()
        assert not Environment.objects.filter(organization_id=from_org.id).exists()
        assert Environment.objects.filter(organization_id=to_org.id).count() == 2
        assert EnvironmentProject.objects.filter(project_id=project.id).count() == 2
        assert AlertRule.objects.filter(id=alert_rule.id).exists()
        assert (
            SnubaQuery.objects.filter(id=alert_rule.snuba_query.id)
            .exclude(environment=None)
            .exists()
        )
