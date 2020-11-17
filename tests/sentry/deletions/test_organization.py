from __future__ import absolute_import

from sentry.models import (
    Commit,
    CommitAuthor,
    Dashboard,
    Environment,
    ExternalIssue,
    Organization,
    PullRequest,
    Release,
    ReleaseCommit,
    ReleaseEnvironment,
    Repository,
    ScheduledDeletion,
    Widget,
    WidgetDataSource,
)
from sentry.tasks.deletion import run_deletion
from sentry.testutils import TestCase


class DeleteOrganizationTest(TestCase):
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
        widget_1 = Widget.objects.create(
            dashboard=dashboard, order=1, title="Widget 1", display_type=0
        )
        widget_2 = Widget.objects.create(
            dashboard=dashboard, order=2, title="Widget 2", display_type=5
        )
        widget_1_data = WidgetDataSource.objects.create(
            widget=widget_1, order=1, type=0, name="Incoming data"
        )
        widget_2_data_1 = WidgetDataSource.objects.create(
            widget=widget_2, order=1, type=0, name="Incoming data"
        )
        widget_2_data_2 = WidgetDataSource.objects.create(
            widget=widget_2, order=2, type=0, name="Outcoming data"
        )

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
        assert not Widget.objects.filter(id__in=[widget_1.id, widget_2.id]).exists()
        assert not WidgetDataSource.objects.filter(
            id__in=[widget_1_data.id, widget_2_data_1.id, widget_2_data_2.id]
        ).exists()
