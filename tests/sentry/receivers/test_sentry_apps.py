from __future__ import annotations

from unittest.mock import patch

from sentry.api.serializers import serialize
from sentry.api.serializers.models.user import UserSerializer
from sentry.constants import SentryAppInstallationStatus
from sentry.models import Activity, Commit, GroupAssignee, GroupLink, Release, Repository
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers import Feature
from sentry.testutils.helpers.faux import faux
from sentry.testutils.helpers.features import with_feature
from sentry.testutils.silo import exempt_from_silo_limits, region_silo_test

# This testcase needs to be an APITestCase because all of the logic to resolve
# Issues and kick off side effects are just chillin in the endpoint code -_-
from sentry.types.activity import ActivityType


@patch("sentry.tasks.sentry_apps.workflow_notification.delay")
@region_silo_test(stable=True)
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
        with exempt_from_silo_limits():
            self.install.save()

        self.update_issue()
        assert not delay.called


@patch("sentry.tasks.sentry_functions.send_sentry_function_webhook.delay")
@region_silo_test(stable=True)
class TestIssueWorkflowNotificationsSentryFunctions(APITestCase):
    def setUp(self):
        super().setUp()
        self.create_organization(owner=self.user, name="RowdyTiger")
        self.login_as(user=self.user)
        self.sentryFunction = self.create_sentry_function(
            organization_id=self.organization.id,
            name="foo",
            author="bar",
            code="baz",
            overview="qux",
            events=["issue", "comment", "error"],
        )
        self.issue = self.create_group(project=self.project)

        self.url = f"/api/0/projects/{self.organization.slug}/{self.issue.project.slug}/issues/?id={self.issue.id}"

    def update_issue(self, _data=None):
        data = {"status": "resolved"}
        data.update(_data or {})
        self.client.put(self.url, data=data, format="json")

    def test_notify_after_basic_resolved(self, delay):
        with Feature("organizations:sentry-functions"):
            self.update_issue()
            sub_data = {"resolution_type": "now"}
            with exempt_from_silo_limits():
                sub_data["user"] = serialize(self.user)
            assert faux(delay).called_with(
                self.sentryFunction.external_id,
                "issue.resolved",
                self.issue.id,
                sub_data,
            )

    def test_notify_after_resolve_in_commit(self, delay):
        with Feature("organizations:sentry-functions"):
            repo = self.create_repo(project=self.project)
            commit = self.create_commit(repo=repo)

            self.update_issue(
                {"statusDetails": {"inCommit": {"repository": repo.name, "commit": commit.key}}}
            )
            sub_data = {"resolution_type": "in_commit"}
            with exempt_from_silo_limits():
                sub_data["user"] = serialize(self.user)
            assert faux(delay).called_with(
                self.sentryFunction.external_id,
                "issue.resolved",
                self.issue.id,
                sub_data,
            )

    def test_notify_after_resolve_in_specific_release(self, delay):

        with Feature("organizations:sentry-functions"):
            release = self.create_release(project=self.project)
            self.update_issue({"statusDetails": {"inRelease": release.version}})
            sub_data = {"resolution_type": "in_release"}
            with exempt_from_silo_limits():
                sub_data["user"] = serialize(self.user)
            assert faux(delay).called_with(
                self.sentryFunction.external_id,
                "issue.resolved",
                self.issue.id,
                sub_data,
            )

    def test_notify_after_resolve_in_latest_release(self, delay):

        with Feature("organizations:sentry-functions"):
            self.create_release(project=self.project)

            self.update_issue({"statusDetails": {"inRelease": "latest"}})
            sub_data = {"resolution_type": "in_release"}
            with exempt_from_silo_limits():
                sub_data["user"] = serialize(self.user)
            assert faux(delay).called_with(
                self.sentryFunction.external_id,
                "issue.resolved",
                self.issue.id,
                sub_data,
            )

    def test_notify_after_resolve_in_next_release(self, delay):
        with Feature("organizations:sentry-functions"):
            self.create_release(project=self.project)

            self.update_issue({"statusDetails": {"inNextRelease": True}})

            sub_data = {"resolution_type": "in_next_release"}

            with exempt_from_silo_limits():
                sub_data["user"] = serialize(self.user)
            assert faux(delay).called_with(
                self.sentryFunction.external_id,
                "issue.resolved",
                self.issue.id,
                sub_data,
            )

    def test_notify_after_resolve_from_set_commits(self, delay):
        with Feature("organizations:sentry-functions"):
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
            sub_data = {"resolution_type": "with_commit"}
            assert faux(delay).called_with(
                self.sentryFunction.external_id,
                "issue.resolved",
                self.issue.id,
                sub_data,
            )

    def test_notify_after_issue_ignored(self, delay):

        with Feature("organizations:sentry-functions"):
            self.update_issue({"status": "ignored"})
            sub_data = {}
            with exempt_from_silo_limits():
                sub_data["user"] = serialize(self.user)
            assert faux(delay).called_with(
                self.sentryFunction.external_id,
                "issue.ignored",
                self.issue.id,
                sub_data,
            )


@patch("sentry.tasks.sentry_apps.workflow_notification.delay")
@region_silo_test(stable=True)
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

    def test_after_issue_reassigned(self, delay):
        GroupAssignee.objects.assign(self.issue, self.assignee, self.user)

        new_assignee = self.create_user(name="Berry", email="berry@example.com")
        GroupAssignee.objects.assign(self.issue, new_assignee, self.user)

        assert faux(delay).called_with(
            installation_id=self.install.id,
            issue_id=self.issue.id,
            type="assigned",
            user_id=self.user.id,
            data={
                "assignee": {
                    "type": "user",
                    "name": new_assignee.name,
                    "email": new_assignee.email,
                    "id": new_assignee.id,
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


@with_feature("organizations:sentry-functions")
@patch("sentry.tasks.sentry_functions.send_sentry_function_webhook.delay")
@region_silo_test(stable=True)
class TestIssueAssignedSentryFunctions(APITestCase):
    def setUp(self):
        super().setUp()
        self.create_organization(owner=self.user, name="RowdyTiger")
        self.login_as(user=self.user)
        self.sentryFunction = self.create_sentry_function(
            organization_id=self.organization.id,
            name="foo",
            author="bar",
            code="baz",
            overview="qux",
            events=["issue", "comment", "error"],
        )
        self.issue = self.create_group(project=self.project)
        self.assignee = self.create_user(name="Bert", email="bert@example.com")

    def test_after_issue_assigned(self, delay):
        GroupAssignee.objects.assign(self.issue, self.assignee, self.user)
        sub_data = {
            "assignee": {
                "type": "user",
                "name": self.assignee.name,
                "id": self.assignee.id,
                "email": self.assignee.email,
            }
        }
        sub_data["user"] = serialize(self.user, UserSerializer())
        assert faux(delay).called_with(
            self.sentryFunction.external_id,
            "issue.assigned",
            self.issue.id,
            sub_data,
        )

    def test_after_issue_assigned_with_enhanced_privacy(self, delay):
        org = self.issue.project.organization
        org.flags.enhanced_privacy = True
        org.save()

        GroupAssignee.objects.assign(self.issue, self.assignee, self.user)
        # excludes email
        sub_data = {
            "assignee": {
                "type": "user",
                "name": self.assignee.name,
                "id": self.assignee.id,
            }
        }
        sub_data["user"] = serialize(self.user, UserSerializer())
        assert faux(delay).called_with(
            self.sentryFunction.external_id,
            "issue.assigned",
            self.issue.id,
            sub_data,
        )


@patch("sentry.tasks.sentry_apps.build_comment_webhook.delay")
@region_silo_test(stable=True)
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


@patch("sentry.tasks.sentry_functions.send_sentry_function_webhook.delay")
@region_silo_test(stable=True)
class TestCommentsSentryFunctions(APITestCase):
    def setUp(self):
        super().setUp()
        self.issue = self.create_group(project=self.project)
        self.login_as(self.user)
        self.create_organization(owner=self.user, name="RowdyTiger")
        self.sentryFunction = self.create_sentry_function(
            organization_id=self.organization.id,
            name="foo",
            author="bar",
            code="baz",
            overview="qux",
            events=["issue", "comment", "error"],
        )

    def test_comment_created(self, delay):
        with Feature("organizations:sentry-functions"):
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
            with exempt_from_silo_limits():
                data["user"] = serialize(self.user)
            assert faux(delay).called_with(
                self.sentryFunction.external_id,
                "comment.created",
                self.issue.id,
                data,
            )

    def test_comment_updated(self, delay):

        with Feature("organizations:sentry-functions"):
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
            with exempt_from_silo_limits():
                data["user"] = serialize(self.user)
            assert faux(delay).called_with(
                self.sentryFunction.external_id,
                "comment.updated",
                self.issue.id,
                data,
            )

    def test_comment_deleted(self, delay):
        with Feature("organizations:sentry-functions"):
            note = self.create_comment(self.issue, self.project, self.user)
            url = f"/api/0/issues/{self.issue.id}/notes/{note.id}/"
            self.client.delete(url, format="json")
            data = {
                "comment_id": note.id,
                "timestamp": note.datetime,
                "comment": "hello world",
                "project_slug": self.project.slug,
            }
            with exempt_from_silo_limits():
                data["user"] = serialize(self.user)
            assert faux(delay).called_with(
                self.sentryFunction.external_id,
                "comment.deleted",
                self.issue.id,
                data,
            )
