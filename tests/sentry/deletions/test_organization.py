from uuid import uuid4

from sentry.discover.models import DiscoverSavedQuery, DiscoverSavedQueryProject
from sentry.incidents.models import AlertRule, AlertRuleStatus
from sentry.models import (
    Commit,
    CommitAuthor,
    Dashboard,
    DashboardWidget,
    DashboardWidgetQuery,
    DashboardWidgetTypes,
    Environment,
    ExternalIssue,
    Group,
    Organization,
    OrganizationStatus,
    PullRequest,
    Release,
    ReleaseCommit,
    ReleaseEnvironment,
    Repository,
    ScheduledDeletion,
)
from sentry.snuba.models import SnubaQuery
from sentry.tasks.deletion import run_deletion
from sentry.testutils import TransactionTestCase


class DeleteOrganizationTest(TransactionTestCase):
    def test_simple(self):
        org = self.create_organization(name="test")
        org2 = self.create_organization(name="test2")
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

        env = Environment.objects.create(organization_id=org.id, project_id=4, name="foo")
        release_env = ReleaseEnvironment.objects.create(
            organization_id=org.id, project_id=4, release_id=release.id, environment_id=env.id
        )

        external_issue = ExternalIssue.objects.create(
            organization_id=org.id, integration_id=5, key="12345"
        )

        dashboard = Dashboard.objects.create(
            organization_id=org.id, title="The Dashboard", created_by=self.user
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
        deletion = ScheduledDeletion.schedule(org, days=0)
        deletion.update(in_progress=True)

        with self.tasks():
            run_deletion(deletion.id)

        assert Organization.objects.filter(id=org2.id).exists()

        assert not Organization.objects.filter(id=org.id).exists()
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

        deletion = ScheduledDeletion.schedule(org, days=0)
        deletion.update(in_progress=True)
        assert org.status == OrganizationStatus.ACTIVE

        with self.tasks():
            run_deletion(deletion.id)

        assert Organization.objects.filter(id=org.id).exists()
        assert Release.objects.filter(id=release.id).exists()
        assert not ScheduledDeletion.objects.filter(id=deletion.id).exists()

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
        deletion = ScheduledDeletion.schedule(org, days=0)
        deletion.update(in_progress=True)

        with self.tasks():
            run_deletion(deletion.id)

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
        deletion = ScheduledDeletion.schedule(org, days=0)
        deletion.update(in_progress=True)

        with self.tasks():
            run_deletion(deletion.id)

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
        deletion = ScheduledDeletion.schedule(org, days=0)
        deletion.update(in_progress=True)

        with self.tasks():
            run_deletion(deletion.id)

        assert not Organization.objects.filter(id=org.id).exists()
        assert not Commit.objects.filter(id=commit.id).exists()
        assert not CommitAuthor.objects.filter(id=author.id).exists()

    def test_alert_rule(self):
        org = self.create_organization(name="test", owner=self.user)
        self.create_team(organization=org, name="test1")

        env = Environment.objects.create(organization_id=org.id, name="foo")
        snuba_query = SnubaQuery.objects.create(
            dataset="events", aggregate="count()", time_window=60, resolution=60, environment=env
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
        deletion = ScheduledDeletion.schedule(org, days=0)
        deletion.update(in_progress=True)

        with self.tasks():
            run_deletion(deletion.id)

        assert not Organization.objects.filter(id=org.id).exists()
        assert not Environment.objects.filter(id=env.id).exists()
        assert not AlertRule.objects.filter(id=alert_rule.id).exists()
        assert not SnubaQuery.objects.filter(id=snuba_query.id).exists()

    def test_discover_query_cleanup(self):
        org = self.create_organization(name="test", owner=self.user)
        self.create_team(organization=org, name="test1")

        other = self.create_organization(name="other", owner=self.user)
        other_project = self.create_project(organization=other, name="other project")

        query = DiscoverSavedQuery.objects.create(organization=org, name="test query", query="{}")
        # Make a cross-org project reference. This can happen when an account was
        # merged in the past and we didn't update the discover queries.
        query_project = DiscoverSavedQueryProject.objects.create(
            discover_saved_query=query, project=other_project
        )

        org.update(status=OrganizationStatus.PENDING_DELETION)
        deletion = ScheduledDeletion.schedule(org, days=0)
        deletion.update(in_progress=True)

        with self.tasks():
            run_deletion(deletion.id)

        assert not Organization.objects.filter(id=org.id).exists()
        assert not DiscoverSavedQuery.objects.filter(id=query.id).exists()
        assert not DiscoverSavedQueryProject.objects.filter(id=query_project.id).exists()
