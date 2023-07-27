from datetime import timedelta
from unittest.mock import Mock, patch

import pytest
import responses
from celery.exceptions import MaxRetriesExceededError
from django.utils import timezone

from sentry.integrations.github.integration import GitHubIntegrationProvider
from sentry.models import PullRequest, PullRequestComment, Repository
from sentry.models.commit import Commit
from sentry.models.groupowner import GroupOwner, GroupOwnerType
from sentry.models.options.organization_option import OrganizationOption
from sentry.models.pullrequest import PullRequestCommit
from sentry.shared_integrations.exceptions.base import ApiError
from sentry.snuba.sessions_v2 import isoformat_z
from sentry.tasks.commit_context import process_commit_context
from sentry.testutils import TestCase
from sentry.testutils.cases import IntegrationTestCase
from sentry.testutils.helpers.datetime import before_now, iso_format
from sentry.testutils.silo import region_silo_test
from sentry.utils.committers import get_frame_paths


class TestCommitContextMixin(TestCase):
    def setUp(self):
        self.project = self.create_project()
        self.repo = Repository.objects.create(
            organization_id=self.organization.id,
            name="example",
            integration_id=self.integration.id,
        )
        self.code_mapping = self.create_code_mapping(
            repo=self.repo,
            project=self.project,
        )
        self.commit_author = self.create_commit_author(project=self.project, user=self.user)
        self.commit = self.create_commit(
            project=self.project,
            repo=self.repo,
            author=self.commit_author,
            key="asdfwreqr",
            message="placeholder commit message",
        )
        self.group = self.create_group(
            project=self.project, message="Kaboom!", first_release=self.release
        )

        self.event = self.store_event(
            data={
                "message": "Kaboom!",
                "platform": "python",
                "timestamp": iso_format(before_now(seconds=10)),
                "stacktrace": {
                    "frames": [
                        {
                            "function": "handle_set_commits",
                            "abs_path": "/usr/src/sentry/src/sentry/tasks.py",
                            "module": "sentry.tasks",
                            "in_app": False,
                            "lineno": 30,
                            "filename": "sentry/tasks.py",
                        },
                        {
                            "function": "set_commits",
                            "abs_path": "/usr/src/sentry/src/sentry/models/release.py",
                            "module": "sentry.models.release",
                            "in_app": True,
                            "lineno": 39,
                            "filename": "sentry/models/release.py",
                        },
                    ]
                },
                "tags": {"sentry:release": self.release.version},
                "fingerprint": ["put-me-in-the-control-group"],
            },
            project_id=self.project.id,
        )


@region_silo_test(stable=True)
class TestCommitContext(TestCommitContextMixin):
    @patch(
        "sentry.integrations.github.GitHubIntegration.get_commit_context",
        return_value={
            "commitId": "asdfwreqr",
            "committedDate": "2023-02-14T11:11Z",
            "commitMessage": "placeholder commit message",
            "commitAuthorName": "",
            "commitAuthorEmail": "admin@localhost",
        },
    )
    def test_simple(self, mock_get_commit_context):
        with self.tasks():
            assert not GroupOwner.objects.filter(group=self.event.group).exists()
            event_frames = get_frame_paths(self.event)
            process_commit_context(
                event_id=self.event.event_id,
                event_platform=self.event.platform,
                event_frames=event_frames,
                group_id=self.event.group_id,
                project_id=self.event.project_id,
            )
        assert GroupOwner.objects.get(
            group=self.event.group,
            project=self.event.project,
            organization=self.event.project.organization,
            type=GroupOwnerType.SUSPECT_COMMIT.value,
        )

        assert GroupOwner.objects.get(
            group=self.event.group,
            project=self.event.project,
            organization=self.event.project.organization,
            type=GroupOwnerType.SUSPECT_COMMIT.value,
        ).context == {"commitId": self.commit.id}

    @patch("sentry.analytics.record")
    @patch(
        "sentry.integrations.github.GitHubIntegration.get_commit_context",
        side_effect=ApiError(text="integration_failed"),
    )
    def test_failed_to_fetch_commit_context_record(self, mock_get_commit_context, mock_record):
        with self.tasks():
            assert not GroupOwner.objects.filter(group=self.event.group).exists()
            event_frames = get_frame_paths(self.event)
            process_commit_context(
                event_id=self.event.event_id,
                event_platform=self.event.platform,
                event_frames=event_frames,
                group_id=self.event.group_id,
                project_id=self.event.project_id,
            )

        mock_record.assert_called_with(
            "integrations.failed_to_fetch_commit_context",
            organization_id=self.organization.id,
            project_id=self.project.id,
            code_mapping_id=self.code_mapping.id,
            group_id=self.event.group_id,
            provider="github",
            error_message="integration_failed",
        )

    @patch(
        "sentry.integrations.github.GitHubIntegration.get_commit_context",
        return_value={
            "commitId": "asdfasdf",
            "committedDate": "2023-02-14T11:11Z",
            "commitMessage": "placeholder commit message",
            "commitAuthorName": "",
            "commitAuthorEmail": "admin@localhost",
        },
    )
    def test_no_matching_commit_in_db(self, mock_get_commit_context):
        with self.tasks():
            assert not GroupOwner.objects.filter(group=self.event.group).exists()
            assert not Commit.objects.filter(key="asdfasdf").exists()
            event_frames = get_frame_paths(self.event)
            process_commit_context(
                event_id=self.event.event_id,
                event_platform=self.event.platform,
                event_frames=event_frames,
                group_id=self.event.group_id,
                project_id=self.event.project_id,
            )
        assert Commit.objects.filter(key="asdfasdf").exists()
        assert GroupOwner.objects.filter(group=self.event.group).exists()

    @patch(
        "sentry.integrations.github.GitHubIntegration.get_commit_context",
        return_value={
            "commitId": "asdfwreqr",
            "committedDate": "2023-02-14T11:11Z",
            "commitMessage": "placeholder commit message",
            "commitAuthorName": "",
            "commitAuthorEmail": "admin@localhost",
        },
    )
    def test_delete_old_entries(self, mock_get_commit_context):
        # As new events come in associated with new owners, we should delete old ones.
        user_2 = self.create_user("another@user.com", is_superuser=True)
        self.create_member(teams=[self.team], user=user_2, organization=self.organization)
        owner = GroupOwner.objects.create(
            group=self.event.group,
            user_id=user_2.id,
            project=self.project,
            organization=self.organization,
            type=GroupOwnerType.SUSPECT_COMMIT.value,
            date_added=timezone.now() - timedelta(days=8),
        )
        with self.tasks():
            event_frames = get_frame_paths(self.event)
            process_commit_context(
                event_id=self.event.event_id,
                event_platform=self.event.platform,
                event_frames=event_frames,
                group_id=self.event.group_id,
                project_id=self.event.project_id,
            )
            assert not GroupOwner.objects.filter(id=owner.id).exists()
            assert GroupOwner.objects.filter(group=self.event.group).count() == 1
            assert GroupOwner.objects.filter(group=self.event.group, user_id=self.user.id).exists()

    @patch("sentry.tasks.groupowner.process_suspect_commits.delay")
    def test_no_inapp_frame_in_stacktrace(self, mock_process_suspect_commits):
        with self.tasks():
            assert not GroupOwner.objects.filter(group=self.event.group).exists()
            self.event_2 = self.store_event(
                data={
                    "message": "Kaboom!",
                    "platform": "python",
                    "timestamp": iso_format(before_now(seconds=10)),
                    "stacktrace": {
                        "frames": [
                            {
                                "function": "handle_set_commits",
                                "abs_path": "/usr/src/sentry/src/sentry/tasks.py",
                                "module": "sentry.tasks",
                                "in_app": False,
                                "lineno": 30,
                                "filename": "sentry/tasks.py",
                            },
                            {
                                "function": "set_commits",
                                "abs_path": "/usr/src/sentry/src/sentry/models/release.py",
                                "module": "sentry.models.release",
                                "in_app": False,
                                "lineno": 39,
                                "filename": "sentry/models/release.py",
                            },
                        ]
                    },
                    "tags": {"sentry:release": self.release.version},
                    "fingerprint": ["put-me-in-the-control-group"],
                },
                project_id=self.project.id,
            )
            event_frames = get_frame_paths(self.event_2)
            process_commit_context(
                event_id=self.event.event_id,
                event_platform=self.event.platform,
                event_frames=event_frames,
                group_id=self.event.group_id,
                project_id=self.event.project_id,
            )
        assert mock_process_suspect_commits.call_count == 1
        assert not GroupOwner.objects.filter(
            group=self.event.group,
            project=self.event.project,
            organization=self.event.project.organization,
            type=GroupOwnerType.SUSPECT_COMMIT.value,
        ).exists()

    @patch(
        "sentry.integrations.github.GitHubIntegration.get_commit_context",
        return_value={
            "commitId": "somekey",
            "committedDate": "2023-02-14T11:11Z",
            "commitMessage": "placeholder commit message",
            "commitAuthorName": "",
            "commitAuthorEmail": "randomuser@sentry.io",
        },
    )
    def test_commit_author_not_in_sentry(self, mock_get_commit_context):
        self.commit_author_2 = self.create_commit_author(
            project=self.project,
        )
        self.commit_2 = self.create_commit(
            project=self.project,
            repo=self.repo,
            author=self.commit_author_2,
            key="somekey",
            message="placeholder commit message",
        )

        with self.tasks():
            assert not GroupOwner.objects.filter(group=self.event.group).exists()
            event_frames = get_frame_paths(self.event)
            process_commit_context(
                event_id=self.event.event_id,
                event_platform=self.event.platform,
                event_frames=event_frames,
                group_id=self.event.group_id,
                project_id=self.event.project_id,
            )
        assert GroupOwner.objects.filter(group=self.event.group).exists()
        assert len(GroupOwner.objects.filter(group=self.event.group)) == 1
        owner = GroupOwner.objects.get(group=self.event.group)
        assert owner.type == GroupOwnerType.SUSPECT_COMMIT.value
        assert owner.user_id is None
        assert owner.team is None
        assert owner.context == {"commitId": self.commit_2.id}

    @patch("sentry.tasks.commit_context.get_users_for_authors", return_value={})
    @patch(
        "sentry.integrations.github.GitHubIntegration.get_commit_context",
        return_value={
            "commitId": "somekey",
            "committedDate": "2023-02-14T11:11Z",
            "commitMessage": "placeholder commit message",
            "commitAuthorName": "",
            "commitAuthorEmail": "randomuser@sentry.io",
        },
    )
    def test_commit_author_no_user(self, mock_get_commit_context, mock_get_users_for_author):
        self.commit_author_2 = self.create_commit_author(
            project=self.project,
        )
        self.commit_2 = self.create_commit(
            project=self.project,
            repo=self.repo,
            author=self.commit_author_2,
            key="somekey",
            message="placeholder commit message",
        )

        with self.tasks(), patch(
            "sentry.tasks.commit_context.get_users_for_authors", return_value={}
        ):
            event_frames = get_frame_paths(self.event)
            process_commit_context(
                event_id=self.event.event_id,
                event_platform=self.event.platform,
                event_frames=event_frames,
                group_id=self.event.group_id,
                project_id=self.event.project_id,
            )
        assert GroupOwner.objects.filter(group=self.event.group).exists()
        assert len(GroupOwner.objects.filter(group=self.event.group)) == 1
        owner = GroupOwner.objects.get(group=self.event.group)
        assert owner.type == GroupOwnerType.SUSPECT_COMMIT.value
        assert owner.user_id is None
        assert owner.team is None
        assert owner.context == {"commitId": self.commit_2.id}

    @patch(
        "sentry.integrations.github.GitHubIntegration.get_commit_context",
        return_value={
            "commitId": "somekey",
            "committedDate": "2023-02-14T11:11Z",
            "commitMessage": "placeholder commit message",
            "commitAuthorName": "",
            "commitAuthorEmail": "randomuser@sentry.io",
        },
    )
    def test_multiple_matching_code_mappings_but_only_1_repository_has_the_commit_in_db(
        self, mock_get_commit_context
    ):

        self.integration_2 = self.create_integration(
            organization=self.organization,
            provider="github",
            name="GitHub",
            external_id="github:2",
        )

        self.repo_2 = Repository.objects.create(
            organization_id=self.organization.id,
            name="another/example",
            integration_id=self.integration_2.id,
        )
        self.code_mapping_2 = self.create_code_mapping(
            repo=self.repo_2, project=self.project, stack_root="src", source_root="src"
        )

        self.commit_author_2 = self.create_commit_author(
            project=self.project,
        )
        self.commit_2 = self.create_commit(
            project=self.project,
            repo=self.repo_2,
            author=self.commit_author_2,
            key="somekey",
            message="placeholder commit message",
        )

        with self.tasks():
            assert not GroupOwner.objects.filter(group=self.event.group).exists()
            event_frames = get_frame_paths(self.event)
            process_commit_context(
                event_id=self.event.event_id,
                event_platform=self.event.platform,
                event_frames=event_frames,
                group_id=self.event.group_id,
                project_id=self.event.project_id,
            )
        assert GroupOwner.objects.filter(group=self.event.group).exists()
        assert len(GroupOwner.objects.filter(group=self.event.group)) == 1
        owner = GroupOwner.objects.get(group=self.event.group)
        assert owner.type == GroupOwnerType.SUSPECT_COMMIT.value
        assert owner.user_id is None
        assert owner.team is None
        assert owner.context == {"commitId": self.commit_2.id}

    @patch(
        "sentry.integrations.github.GitHubIntegration.get_commit_context",
        side_effect=ApiError(text="integration_failed"),
    )
    @patch("sentry.tasks.groupowner.process_suspect_commits.delay")
    def test_fallback_if_max_retries_exceeded(self, mock_suspect_commits, mock_get_commit_context):
        def after_return(self, status, retval, task_id, args, kwargs, einfo):
            raise MaxRetriesExceededError()

        with self.tasks() and pytest.raises(MaxRetriesExceededError):
            with patch("celery.app.task.Task.after_return", after_return):
                process_commit_context.apply(
                    kwargs={
                        "event_id": self.event.event_id,
                        "event_platform": self.event.platform,
                        "event_frames": get_frame_paths(self.event),
                        "group_id": self.event.group_id,
                        "project_id": self.event.project_id,
                    },
                    retries=1,
                )

            assert mock_suspect_commits.called


@region_silo_test(stable=True)
@patch(
    "sentry.integrations.github.GitHubIntegration.get_commit_context",
    Mock(
        return_value={
            "commitId": "asdfwreqr",
            "committedDate": "2023-02-14T11:11Z",
            "commitMessage": "placeholder commit message",
            "commitAuthorName": "",
            "commitAuthorEmail": "admin@localhost",
        }
    ),
)
@patch("sentry.tasks.integrations.github.pr_comment.github_comment_workflow.delay")
class TestGHCommentQueuing(IntegrationTestCase, TestCommitContextMixin):
    provider = GitHubIntegrationProvider
    base_url = "https://api.github.com"

    def setUp(self):
        super().setUp()
        self.pull_request = PullRequest.objects.create(
            organization_id=self.commit.organization_id,
            repository_id=self.repo.id,
            key="99",
            author=self.commit.author,
            message="foo",
            title="bar",
            merge_commit_sha=self.commit.key,
            date_added=iso_format(before_now(days=1)),
        )
        self.repo.provider = "integrations:github"
        self.repo.save()
        self.pull_request_comment = PullRequestComment.objects.create(
            pull_request=self.pull_request,
            external_id=1,
            created_at=iso_format(before_now(days=1)),
            updated_at=iso_format(before_now(days=1)),
            group_ids=[],
        )
        self.installation_id = "github:1"
        self.user_id = "user_1"
        self.app_id = "app_1"
        self.access_token = "xxxxx-xxxxxxxxx-xxxxxxxxxx-xxxxxxxxxxxx"
        self.expires_at = isoformat_z(timezone.now() + timedelta(days=365))

    def add_responses(self):
        responses.add(
            responses.POST,
            self.base_url + f"/app/installations/{self.installation_id}/access_tokens",
            json={"token": self.access_token, "expires_at": self.expires_at},
        )
        responses.add(
            responses.GET,
            self.base_url + f"/repos/example/commits/{self.commit.key}/pulls",
            status=200,
            json=[{"merge_commit_sha": self.pull_request.merge_commit_sha}],
        )

    def test_gh_comment_not_github(self, mock_comment_workflow):
        """Non github repos shouldn't be commented on"""
        self.repo.provider = "integrations:gitlab"
        self.repo.save()
        with self.tasks():
            event_frames = get_frame_paths(self.event)
            process_commit_context(
                event_id=self.event.event_id,
                event_platform=self.event.platform,
                event_frames=event_frames,
                group_id=self.event.group_id,
                project_id=self.event.project_id,
            )
            assert not mock_comment_workflow.called

    def test_gh_comment_org_option(self, mock_comment_workflow):
        """No comments on org with organization option disabled"""
        OrganizationOption.objects.set_value(
            organization=self.project.organization, key="sentry:github_pr_bot", value=False
        )

        with self.tasks():
            event_frames = get_frame_paths(self.event)
            process_commit_context(
                event_id=self.event.event_id,
                event_platform=self.event.platform,
                event_frames=event_frames,
                group_id=self.event.group_id,
                project_id=self.event.project_id,
            )
            assert not mock_comment_workflow.called

    @patch("sentry.integrations.github.client.get_jwt", return_value=b"jwt_token_1")
    @responses.activate
    def test_gh_comment_no_pr_from_api(self, get_jwt, mock_comment_workflow):
        """No comments on suspect commit with no pr returned from API response"""
        self.pull_request.delete()

        responses.add(
            responses.POST,
            self.base_url + f"/app/installations/{self.installation_id}/access_tokens",
            json={"token": self.access_token, "expires_at": self.expires_at},
        )
        responses.add(
            responses.GET,
            self.base_url + f"/repos/example/commits/{self.commit.key}/pulls",
            status=200,
            json={"message": "No commit found for SHA"},
        )

        with self.tasks():
            event_frames = get_frame_paths(self.event)
            process_commit_context(
                event_id=self.event.event_id,
                event_platform=self.event.platform,
                event_frames=event_frames,
                group_id=self.event.group_id,
                project_id=self.event.project_id,
            )
            assert not mock_comment_workflow.called

    @patch("sentry.integrations.github.client.get_jwt", return_value=b"jwt_token_1")
    @patch("sentry_sdk.capture_exception")
    @responses.activate
    def test_gh_comment_api_error(self, mock_capture_exception, get_jwt, mock_comment_workflow):
        """Captures exception if Github API call errors"""

        responses.add(
            responses.POST,
            self.base_url + f"/app/installations/{self.installation_id}/access_tokens",
            json={"token": self.access_token, "expires_at": self.expires_at},
        )
        responses.add(
            responses.GET,
            self.base_url + f"/repos/example/commits/{self.commit.key}/pulls",
            status=400,
            json={"message": "error"},
        )

        with self.tasks():
            event_frames = get_frame_paths(self.event)
            process_commit_context(
                event_id=self.event.event_id,
                event_platform=self.event.platform,
                event_frames=event_frames,
                group_id=self.event.group_id,
                project_id=self.event.project_id,
            )
            assert mock_capture_exception.called
            assert not mock_comment_workflow.called

    @patch("sentry.integrations.github.client.get_jwt", return_value=b"jwt_token_1")
    @responses.activate
    def test_gh_comment_commit_not_in_default_branch(self, get_jwt, mock_comment_workflow):
        """No comments on commit not in default branch"""

        responses.add(
            responses.POST,
            self.base_url + f"/app/installations/{self.installation_id}/access_tokens",
            json={"token": self.access_token, "expires_at": self.expires_at},
        )
        responses.add(
            responses.GET,
            self.base_url + f"/repos/example/commits/{self.commit.key}/pulls",
            status=200,
            json=[{"merge_commit_sha": "abcd"}, {"merge_commit_sha": "efgh"}],
        )

        with self.tasks():
            event_frames = get_frame_paths(self.event)
            process_commit_context(
                event_id=self.event.event_id,
                event_platform=self.event.platform,
                event_frames=event_frames,
                group_id=self.event.group_id,
                project_id=self.event.project_id,
            )
            assert not mock_comment_workflow.called

    @patch("sentry.integrations.github.client.get_jwt", return_value=b"jwt_token_1")
    @responses.activate
    def test_gh_comment_no_pr_from_query(self, get_jwt, mock_comment_workflow):
        """No comments on suspect commit with no pr row in table"""
        self.pull_request.delete()

        self.add_responses()

        with self.tasks():
            event_frames = get_frame_paths(self.event)
            process_commit_context(
                event_id=self.event.event_id,
                event_platform=self.event.platform,
                event_frames=event_frames,
                group_id=self.event.group_id,
                project_id=self.event.project_id,
            )
            assert not mock_comment_workflow.called

    @patch("sentry.integrations.github.client.get_jwt", return_value=b"jwt_token_1")
    @responses.activate
    def test_gh_comment_pr_too_old(self, get_jwt, mock_comment_workflow):
        """No comment on pr that's older than 30 days"""
        self.pull_request.date_added = iso_format(before_now(days=8))
        self.pull_request.save()

        self.add_responses()

        with self.tasks():
            event_frames = get_frame_paths(self.event)
            process_commit_context(
                event_id=self.event.event_id,
                event_platform=self.event.platform,
                event_frames=event_frames,
                group_id=self.event.group_id,
                project_id=self.event.project_id,
            )
            assert not mock_comment_workflow.called
            assert len(PullRequestCommit.objects.all()) == 0

    @patch("sentry.integrations.github.client.get_jwt", return_value=b"jwt_token_1")
    @responses.activate
    def test_gh_comment_repeat_issue(self, get_jwt, mock_comment_workflow):
        """No comment on a pr that has a comment with the issue in the same pr list"""
        self.pull_request_comment.group_ids.append(self.event.group_id)
        self.pull_request_comment.save()

        self.add_responses()

        with self.tasks():
            event_frames = get_frame_paths(self.event)
            process_commit_context(
                event_id=self.event.event_id,
                event_platform=self.event.platform,
                event_frames=event_frames,
                group_id=self.event.group_id,
                project_id=self.event.project_id,
            )
            assert not mock_comment_workflow.called
            assert len(PullRequestCommit.objects.all()) == 0

    @patch("sentry.integrations.github.client.get_jwt", return_value=b"jwt_token_1")
    @responses.activate
    def test_gh_comment_create_queued(self, get_jwt, mock_comment_workflow):
        """Task queued if no prior comment exists"""
        self.pull_request_comment.delete()

        self.add_responses()

        with self.tasks():
            event_frames = get_frame_paths(self.event)
            process_commit_context(
                event_id=self.event.event_id,
                event_platform=self.event.platform,
                event_frames=event_frames,
                group_id=self.event.group_id,
                project_id=self.event.project_id,
            )
            assert mock_comment_workflow.called

            pr_commits = PullRequestCommit.objects.all()
            assert len(pr_commits) == 1
            assert pr_commits[0].commit == self.commit

    @patch("sentry.integrations.github.client.get_jwt", return_value=b"jwt_token_1")
    @responses.activate
    def test_gh_comment_create_queued_existing_pr_commit(self, get_jwt, mock_comment_workflow):
        """Task queued if no prior comment exists"""
        pr_commit = PullRequestCommit.objects.create(
            commit=self.commit, pull_request=self.pull_request
        )
        self.pull_request_comment.delete()

        self.add_responses()

        with self.tasks():
            event_frames = get_frame_paths(self.event)
            process_commit_context(
                event_id=self.event.event_id,
                event_platform=self.event.platform,
                event_frames=event_frames,
                group_id=self.event.group_id,
                project_id=self.event.project_id,
            )
            assert mock_comment_workflow.called

            pr_commits = PullRequestCommit.objects.all()
            assert len(pr_commits) == 1
            assert pr_commits[0] == pr_commit

    @patch("sentry.integrations.github.client.get_jwt", return_value=b"jwt_token_1")
    @responses.activate
    def test_gh_comment_update_queue(self, get_jwt, mock_comment_workflow):
        """Task queued if new issue for prior comment"""

        self.add_responses()

        with self.tasks():
            assert not GroupOwner.objects.filter(group=self.event.group).exists()
            event_frames = get_frame_paths(self.event)
            process_commit_context(
                event_id=self.event.event_id,
                event_platform=self.event.platform,
                event_frames=event_frames,
                group_id=self.event.group_id,
                project_id=self.event.project_id,
            )
            assert mock_comment_workflow.called

            pr_commits = PullRequestCommit.objects.all()
            assert len(pr_commits) == 1
            assert pr_commits[0].commit == self.commit

    def test_gh_comment_no_repo(self, mock_comment_workflow):
        """No comments on suspect commit if no repo row exists"""
        self.repo.delete()
        with self.tasks():
            event_frames = get_frame_paths(self.event)
            process_commit_context(
                event_id=self.event.event_id,
                event_platform=self.event.platform,
                event_frames=event_frames,
                group_id=self.event.group_id,
                project_id=self.event.project_id,
            )
            assert not mock_comment_workflow.called
            assert len(PullRequestCommit.objects.all()) == 0

    @patch("sentry.integrations.github.client.get_jwt", return_value=b"jwt_token_1")
    @responses.activate
    def test_gh_comment_debounces(self, get_jwt, mock_comment_workflow):
        self.add_responses()

        with self.tasks():
            assert not GroupOwner.objects.filter(group=self.event.group).exists()
            event_frames = get_frame_paths(self.event)
            process_commit_context(
                event_id=self.event.event_id,
                event_platform=self.event.platform,
                event_frames=event_frames,
                group_id=self.event.group_id,
                project_id=self.event.project_id,
            )
            process_commit_context(
                event_id=self.event.event_id,
                event_platform=self.event.platform,
                event_frames=event_frames,
                group_id=self.event.group_id,
                project_id=self.event.project_id,
            )
            assert mock_comment_workflow.call_count == 1
