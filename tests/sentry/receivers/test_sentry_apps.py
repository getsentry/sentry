from unittest.mock import patch

from sentry.constants import SentryAppInstallationStatus
from sentry.models import Activity, Commit, GroupAssignee, GroupLink, Release, Repository
from sentry.testutils import APITestCase
from sentry.testutils.helpers.faux import faux

# This testcase needs to be an APITestCase because all of the logic to resolve
# Issues and kick off side effects are just chillin in the endpoint code -_-
from sentry.types.activity import ActivityType


@patch("sentry.tasks.sentry_apps.workflow_notification.delay")
class TestIssueWorkflowNotifications(APITestCase):
    def setUp(self):
        self.issue = self.create_group(project=self.project)

        self.sentry_app = self.create_sentry_app(events=["issue.resolved", "issue.ignored"])

        self.install = self.create_sentry_app_installation(
            organization=self.organization, slug=self.sentry_app.slug
        )

        self.url = f"/api/0/projects/{self.organization.slug}/{self.issue.project.slug}/issues/?id={self.issue.id}"

        self.login_as(self.user)

    def update_issue(self, _data=None):
        data = {"status": "resolved"}
        data.update(_data or {})
        self.client.put(self.url, data=data, format="json")

    def test_notify_after_basic_resolved(self, delay):
        self.update_issue()

        assert faux(delay).called_with(
            installation_id=self.install.id,
            issue_id=self.issue.id,
            type="resolved",
            user_id=self.user.id,
            data={"resolution_type": "now"},
        )

    def test_notify_after_resolve_in_commit(self, delay):
        repo = self.create_repo(project=self.project)
        commit = self.create_commit(repo=repo)

        self.update_issue(
            {"statusDetails": {"inCommit": {"repository": repo.name, "commit": commit.key}}}
        )

        assert faux(delay).called_with(
            installation_id=self.install.id,
            issue_id=self.issue.id,
            type="resolved",
            user_id=self.user.id,
            data={"resolution_type": "in_commit"},
        )

    def test_notify_after_resolve_in_specific_release(self, delay):
        release = self.create_release(project=self.project)

        self.update_issue({"statusDetails": {"inRelease": release.version}})

        assert faux(delay).called_with(
            installation_id=self.install.id,
            issue_id=self.issue.id,
            type="resolved",
            user_id=self.user.id,
            data={"resolution_type": "in_release"},
        )

    def test_notify_after_resolve_in_latest_release(self, delay):
        self.create_release(project=self.project)

        self.update_issue({"statusDetails": {"inRelease": "latest"}})

        assert faux(delay).called_with(
            installation_id=self.install.id,
            issue_id=self.issue.id,
            type="resolved",
            user_id=self.user.id,
            data={"resolution_type": "in_release"},
        )

    def test_notify_after_resolve_in_next_release(self, delay):
        self.create_release(project=self.project)

        self.update_issue({"statusDetails": {"inNextRelease": True}})

        assert faux(delay).called_with(
            installation_id=self.install.id,
            issue_id=self.issue.id,
            type="resolved",
            user_id=self.user.id,
            data={"resolution_type": "in_next_release"},
        )

    def test_notify_after_resolve_from_set_commits(self, delay):
        repo = Repository.objects.create(organization_id=self.organization.id, name="test/repo")

        release = Release.objects.create(version="abcabc", organization=self.organization)

        commit = Commit.objects.create(
            repository_id=repo.id, organization_id=self.organization.id, key="b" * 40
        )

        GroupLink.objects.create(
            group_id=self.issue.id,
            project_id=self.project.id,
            linked_type=GroupLink.LinkedType.commit,
            linked_id=commit.id,
        )

        release.add_project(self.project)
        release.set_commits(
            [
                {
                    "id": "b" * 40,
                    "repository": repo.name,
                    "author_email": "foo@example.com",
                    "author_name": "Foo Bar",
                    "message": f"FIXES {self.issue.qualified_short_id}",
                }
            ]
        )

        assert faux(delay).called_with(
            installation_id=self.install.id,
            issue_id=self.issue.id,
            type="resolved",
            user_id=None,
            data={"resolution_type": "with_commit"},
        )

    def test_notify_after_issue_ignored(self, delay):
        self.update_issue({"status": "ignored"})

        assert faux(delay).called_with(
            installation_id=self.install.id,
            issue_id=self.issue.id,
            type="ignored",
            user_id=self.user.id,
            data={},
        )

    def test_notify_pending_installation(self, delay):
        self.install.status = SentryAppInstallationStatus.PENDING
        self.install.save()

        self.update_issue()
        assert not delay.called


@patch("sentry.tasks.sentry_apps.workflow_notification.delay")
class TestIssueAssigned(APITestCase):
    def setUp(self):
        self.issue = self.create_group(project=self.project)

        self.sentry_app = self.create_sentry_app(events=["issue.assigned"])

        self.install = self.create_sentry_app_installation(
            organization=self.organization, slug=self.sentry_app.slug
        )

        self.assignee = self.create_user(name="Bert", email="bert@example.com")

    def test_after_issue_assigned(self, delay):
        GroupAssignee.objects.assign(self.issue, self.assignee, self.user)

        assert faux(delay).called_with(
            installation_id=self.install.id,
            issue_id=self.issue.id,
            type="assigned",
            user_id=self.user.id,
            data={
                "assignee": {
                    "type": "user",
                    "name": self.assignee.name,
                    "email": self.assignee.email,
                    "id": self.assignee.id,
                }
            },
        )

    def test_after_issue_assigned_with_enhanced_privacy(self, delay):
        org = self.issue.project.organization
        org.flags.enhanced_privacy = True
        org.save()

        GroupAssignee.objects.assign(self.issue, self.assignee, self.user)

        assert faux(delay).called_with(
            installation_id=self.install.id,
            issue_id=self.issue.id,
            type="assigned",
            user_id=self.user.id,
            data={
                # Excludes email address
                "assignee": {"type": "user", "name": self.assignee.name, "id": self.assignee.id}
            },
        )


@patch("sentry.tasks.sentry_apps.build_comment_webhook.delay")
class TestComments(APITestCase):
    def setUp(self):
        self.issue = self.create_group(project=self.project)
        self.sentry_app = self.create_sentry_app(
            organization=self.project.organization,
            events=["comment.updated", "comment.created", "comment.deleted"],
        )
        self.install = self.create_sentry_app_installation(
            organization=self.organization, slug=self.sentry_app.slug
        )
        self.login_as(self.user)

    def test_comment_created(self, delay):
        url = f"/api/0/issues/{self.issue.id}/notes/"
        data = {"text": "hello world"}
        self.client.post(url, data=data, format="json")
        note = Activity.objects.get(
            group=self.issue, project=self.project, type=ActivityType.NOTE.value
        )
        data = {
            "comment_id": note.id,
            "timestamp": note.datetime,
            "comment": "hello world",
            "project_slug": self.project.slug,
        }
        assert faux(delay).called_with(
            installation_id=self.install.id,
            issue_id=self.issue.id,
            type="comment.created",
            user_id=self.user.id,
            data=data,
        )

    def test_comment_updated(self, delay):
        note = self.create_comment(self.issue, self.project, self.user)
        url = f"/api/0/issues/{self.issue.id}/notes/{note.id}/"
        data = {"text": "goodbye cruel world"}
        self.client.put(url, data=data, format="json")
        data = {
            "comment_id": note.id,
            "timestamp": note.datetime,
            "comment": "goodbye cruel world",
            "project_slug": self.project.slug,
        }
        assert faux(delay).called_with(
            installation_id=self.install.id,
            issue_id=self.issue.id,
            type="comment.updated",
            user_id=self.user.id,
            data=data,
        )

    def test_comment_deleted(self, delay):
        note = self.create_comment(self.issue, self.project, self.user)
        url = f"/api/0/issues/{self.issue.id}/notes/{note.id}/"
        self.client.delete(url, format="json")
        data = {
            "comment_id": note.id,
            "timestamp": note.datetime,
            "comment": "hello world",
            "project_slug": self.project.slug,
        }
        assert faux(delay).called_with(
            installation_id=self.install.id,
            issue_id=self.issue.id,
            type="comment.deleted",
            user_id=self.user.id,
            data=data,
        )
