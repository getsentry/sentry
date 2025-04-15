import logging
from typing import Any
from unittest.mock import Mock, patch

import pytest
from django.utils import timezone

from sentry.integrations.gitlab.constants import GITLAB_CLOUD_BASE_URL
from sentry.integrations.source_code_management.commit_context import (
    CommitContextIntegration,
    CommitContextOrganizationOptionKeys,
    CommitContextReferrerIds,
    CommitContextReferrers,
    PullRequestFile,
    PullRequestIssue,
    SourceLineInfo,
)
from sentry.integrations.source_code_management.constants import STACKFRAME_COUNT
from sentry.integrations.types import EventLifecycleOutcome
from sentry.models.group import Group, GroupStatus
from sentry.models.organization import Organization
from sentry.models.pullrequest import PullRequest
from sentry.models.repository import Repository
from sentry.shared_integrations.exceptions import ApiError
from sentry.snuba.referrer import Referrer
from sentry.testutils.asserts import assert_failure_metric, assert_halt_metric, assert_slo_metric
from sentry.testutils.cases import SnubaTestCase, TestCase
from sentry.testutils.helpers.datetime import before_now
from sentry.types.referrer_ids import GITHUB_OPEN_PR_BOT_REFERRER, GITHUB_PR_BOT_REFERRER
from sentry.users.models.identity import Identity


class MockCommitContextIntegration(CommitContextIntegration):
    """Mock implementation for testing"""

    integration_name = "mock_integration"

    def __init__(self):
        self.client = Mock()
        self.client.base_url = "https://example.com"

    def get_client(self):
        return self.client

    commit_context_referrers = CommitContextReferrers(
        pr_comment_bot=Referrer.GITHUB_PR_COMMENT_BOT,
    )
    commit_context_referrer_ids = CommitContextReferrerIds(
        pr_bot=GITHUB_PR_BOT_REFERRER,
        open_pr_bot=GITHUB_OPEN_PR_BOT_REFERRER,
    )
    commit_context_organization_option_keys = CommitContextOrganizationOptionKeys(
        pr_bot="sentry:github_pr_bot",
    )

    def format_pr_comment(self, issue_ids: list[int]) -> str:
        raise NotImplementedError

    def build_pr_comment_data(
        self,
        organization: Organization,
        repo: Repository,
        pr_key: str,
        comment_body: str,
        issue_ids: list[int],
    ) -> dict[str, Any]:
        raise NotImplementedError

    def queue_comment_task(self, pullrequest_id: int, project_id: int) -> None:
        raise NotImplementedError

    def on_create_or_update_comment_error(self, api_error: ApiError, metrics_base: str) -> bool:
        raise NotImplementedError

    def get_pr_files_safe_for_comment(
        self, repo: Repository, pr: PullRequest
    ) -> list[dict[str, str]]:
        raise NotImplementedError

    def get_pr_files(self, pr_files: list[dict[str, str]]) -> list[PullRequestFile]:
        raise NotImplementedError

    def format_open_pr_comment(self, issue_tables: list[str]) -> str:
        raise NotImplementedError

    def format_issue_table(
        self,
        diff_filename: str,
        issues: list[PullRequestIssue],
        patch_parsers: dict[str, Any],
        toggle: bool,
    ) -> str:
        raise NotImplementedError


class TestCommitContextIntegrationSLO(TestCase):
    def setUp(self):
        super().setUp()
        self.integration = MockCommitContextIntegration()
        self.repo = Repository.objects.create(
            organization_id=self.organization.id,
            name="example/repo",
        )
        self.source_line = SourceLineInfo(
            lineno=10, path="src/file.py", ref="main", repo=self.repo, code_mapping=Mock()
        )

    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_get_blame_for_files_success(self, mock_record):
        """Test successful blame retrieval records correct lifecycle events"""
        self.integration.client.get_blame_for_files.return_value = []

        result = self.integration.get_blame_for_files([self.source_line], {})

        assert result == []
        assert_slo_metric(mock_record, EventLifecycleOutcome.SUCCESS)

    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_get_blame_for_files_missing_identity(self, mock_record):
        """Test missing identity records failure"""
        self.integration.get_client = Mock(side_effect=Identity.DoesNotExist())

        result = self.integration.get_blame_for_files([self.source_line], {})

        assert result == []
        assert len(mock_record.mock_calls) == 2
        assert_slo_metric(mock_record, EventLifecycleOutcome.FAILURE)
        assert_failure_metric(mock_record, Identity.DoesNotExist())

    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_get_blame_for_files_invalid_identity(self, mock_record):
        """Test invalid identity records failure"""
        from sentry.auth.exceptions import IdentityNotValid

        self.integration.client.get_blame_for_files = Mock(side_effect=IdentityNotValid())

        result = self.integration.get_blame_for_files([self.source_line], {})

        assert result == []
        assert_slo_metric(mock_record, EventLifecycleOutcome.FAILURE)
        assert_failure_metric(mock_record, IdentityNotValid())

    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_get_blame_for_files_rate_limited(self, mock_record):
        """Test rate limited requests record halt"""
        from sentry.shared_integrations.exceptions import ApiRateLimitedError

        self.integration.client.get_blame_for_files = Mock(
            side_effect=ApiRateLimitedError(text="Rate limited")
        )

        result = self.integration.get_blame_for_files([self.source_line], {})

        assert result == []
        assert_slo_metric(mock_record, EventLifecycleOutcome.HALTED)
        assert_halt_metric(mock_record, ApiRateLimitedError(text="Rate limited"))

    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_get_blame_for_files_invalid_request(self, mock_record):
        """Test invalid request records failure"""
        from sentry.shared_integrations.exceptions import ApiInvalidRequestError

        self.integration.client.get_blame_for_files = Mock(
            side_effect=ApiInvalidRequestError(text="Invalid request")
        )

        with pytest.raises(ApiInvalidRequestError):
            self.integration.get_blame_for_files([self.source_line], {})

        assert_slo_metric(mock_record, EventLifecycleOutcome.FAILURE)
        assert_failure_metric(mock_record, ApiInvalidRequestError(text="Invalid request"))

    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_get_blame_for_files_invalid_request_gitlab(self, mock_record):
        """Test invalid request for GitLab records halt"""
        from sentry.shared_integrations.exceptions import ApiInvalidRequestError

        class MockGitlabIntegration(MockCommitContextIntegration):
            integration_name = "gitlab"

        self.integration = MockGitlabIntegration()

        self.integration.client.get_blame_for_files = Mock(
            side_effect=ApiInvalidRequestError(text="Invalid request")
        )

        result = self.integration.get_blame_for_files([self.source_line], {})

        assert result == []
        assert_slo_metric(mock_record, EventLifecycleOutcome.HALTED)
        assert_halt_metric(mock_record, ApiInvalidRequestError(text="Invalid request"))

    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_get_blame_for_files_retry_error(self, mock_record):
        """Test retry error for Gitlab Self-hosted records halt"""
        from sentry.shared_integrations.exceptions import ApiRetryError

        # Because this is Gitlab Self-hosted, this should be halt
        class MockGitlabIntegration(MockCommitContextIntegration):
            integration_name = "gitlab"
            base_url = "https://bufo-bot.gitlab.com"

            def __init__(self):
                super().__init__()
                self.client.base_url = self.base_url

        self.integration = MockGitlabIntegration()

        self.integration.client.get_blame_for_files = Mock(
            side_effect=ApiRetryError(text="Host error")
        )

        result = self.integration.get_blame_for_files([self.source_line], {})

        assert result == []
        assert_slo_metric(mock_record, EventLifecycleOutcome.HALTED)
        assert_halt_metric(mock_record, ApiRetryError(text="Host error"))

    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_get_blame_for_files_retry_error_gitlab(self, mock_record):
        """Test retry error for GitLab saas records failure"""
        from sentry.shared_integrations.exceptions import ApiRetryError

        # Because this is Gitlab SAAS, this should be failure
        class MockGitlabIntegration(MockCommitContextIntegration):
            integration_name = "gitlab"
            base_url = GITLAB_CLOUD_BASE_URL

            def __init__(self):
                super().__init__()
                self.client.base_url = self.base_url

        self.integration = MockGitlabIntegration()

        self.integration.client.get_blame_for_files = Mock(
            side_effect=ApiRetryError(text="Host error")
        )

        with pytest.raises(ApiRetryError):
            self.integration.get_blame_for_files([self.source_line], {})

        assert_slo_metric(mock_record, EventLifecycleOutcome.FAILURE)
        assert_failure_metric(mock_record, ApiRetryError(text="Host error"))

    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_get_commit_context_all_frames(self, mock_record):
        """Test get_commit_context_all_frames records correct lifecycle events"""
        self.integration.client.get_blame_for_files.return_value = []

        result = self.integration.get_commit_context_all_frames([self.source_line], {})

        assert result == []
        assert len(mock_record.mock_calls) == 2
        assert_slo_metric(mock_record, EventLifecycleOutcome.SUCCESS)


class TestTop5IssuesByCount(TestCase, SnubaTestCase):
    def setUp(self):
        super().setUp()
        self.integration_impl = MockCommitContextIntegration()

    def test_simple(self):
        group1 = [
            self.store_event(
                {"fingerprint": ["group-1"], "timestamp": before_now(days=1).isoformat()},
                project_id=self.project.id,
            )
            for _ in range(3)
        ][0].group.id
        group2 = [
            self.store_event(
                {"fingerprint": ["group-2"], "timestamp": before_now(days=1).isoformat()},
                project_id=self.project.id,
            )
            for _ in range(6)
        ][0].group.id
        group3 = [
            self.store_event(
                {"fingerprint": ["group-3"], "timestamp": before_now(days=1).isoformat()},
                project_id=self.project.id,
            )
            for _ in range(4)
        ][0].group.id
        res = self.integration_impl.get_top_5_issues_by_count(
            [group1, group2, group3], self.project
        )
        assert [issue["group_id"] for issue in res] == [group2, group3, group1]

    def test_over_5_issues(self):
        issue_ids = [
            self.store_event(
                {"fingerprint": [f"group-{idx}"], "timestamp": before_now(days=1).isoformat()},
                project_id=self.project.id,
            ).group.id
            for idx in range(6)
        ]
        res = self.integration_impl.get_top_5_issues_by_count(issue_ids, self.project)
        assert len(res) == 5

    def test_ignore_info_level_issues(self):
        group1 = [
            self.store_event(
                {
                    "fingerprint": ["group-1"],
                    "timestamp": before_now(days=1).isoformat(),
                    "level": logging.INFO,
                },
                project_id=self.project.id,
            )
            for _ in range(3)
        ][0].group.id
        group2 = [
            self.store_event(
                {"fingerprint": ["group-2"], "timestamp": before_now(days=1).isoformat()},
                project_id=self.project.id,
            )
            for _ in range(6)
        ][0].group.id
        group3 = [
            self.store_event(
                {
                    "fingerprint": ["group-3"],
                    "timestamp": before_now(days=1).isoformat(),
                    "level": logging.INFO,
                },
                project_id=self.project.id,
            )
            for _ in range(4)
        ][0].group.id
        res = self.integration_impl.get_top_5_issues_by_count(
            [group1, group2, group3], self.project
        )
        assert [issue["group_id"] for issue in res] == [group2]

    def test_do_not_ignore_other_issues(self):
        group1 = [
            self.store_event(
                {
                    "fingerprint": ["group-1"],
                    "timestamp": before_now(days=1).isoformat(),
                    "level": logging.ERROR,
                },
                project_id=self.project.id,
            )
            for _ in range(3)
        ][0].group.id
        group2 = [
            self.store_event(
                {
                    "fingerprint": ["group-2"],
                    "timestamp": before_now(days=1).isoformat(),
                    "level": logging.INFO,
                },
                project_id=self.project.id,
            )
            for _ in range(6)
        ][0].group.id
        group3 = [
            self.store_event(
                {
                    "fingerprint": ["group-3"],
                    "timestamp": before_now(days=1).isoformat(),
                    "level": logging.DEBUG,
                },
                project_id=self.project.id,
            )
            for _ in range(4)
        ][0].group.id
        res = self.integration_impl.get_top_5_issues_by_count(
            [group1, group2, group3], self.project
        )
        assert [issue["group_id"] for issue in res] == [group3, group1]


class CreateEventTestCase(TestCase):
    def _create_event(
        self,
        culprit=None,
        timestamp=None,
        filenames=None,
        function_names=None,
        project_id=None,
        user_id=None,
        handled=False,
    ):
        if culprit is None:
            culprit = "issue0"
        if timestamp is None:
            timestamp = before_now(seconds=5).isoformat()
        if filenames is None:
            filenames = ["foo.py", "baz.py"]
        if function_names is None:
            function_names = ["hello", "world"]
        if project_id is None:
            project_id = self.project.id

        assert len(function_names) == len(filenames)

        frames = []
        for i, filename in enumerate(filenames):
            frames.append({"filename": filename, "function": function_names[i]})

        return self.store_event(
            data={
                "message": "hello!",
                "culprit": culprit,
                "platform": "python",
                "timestamp": timestamp,
                "exception": {
                    "values": [
                        {
                            "type": "Error",
                            "stacktrace": {
                                "frames": frames,
                            },
                            "mechanism": {"handled": handled, "type": "generic"},
                        },
                    ]
                },
                "user": {"id": user_id},
            },
            project_id=project_id,
        )


class TestGetCommentIssues(CreateEventTestCase):
    def setUp(self):
        self.group_id = [self._create_event(user_id=str(i)) for i in range(6)][0].group.id
        self.another_org = self.create_organization()
        self.another_org_project = self.create_project(organization=self.another_org)

        self.installation_impl = MockCommitContextIntegration()

    def test_simple(self):
        group_id = [
            self._create_event(function_names=["blue", "planet"], user_id=str(i)) for i in range(7)
        ][0].group.id
        top_5_issues = self.installation_impl.get_top_5_issues_by_count_for_file(
            projects=[self.project], sentry_filenames=["baz.py"], function_names=["world", "planet"]
        )

        top_5_issue_ids = [issue["group_id"] for issue in top_5_issues]
        function_names = [issue["function_name"] for issue in top_5_issues]
        assert top_5_issue_ids == [group_id, self.group_id]
        assert function_names == ["planet", "world"]

    def test_javascript_simple(self):
        # should match function name exactly or className.functionName
        group_id_1 = [
            self._create_event(
                function_names=["other.planet", "component.blue"],
                filenames=["baz.js", "foo.js"],
                user_id=str(i),
            )
            for i in range(7)
        ][0].group.id
        group_id_2 = [
            self._create_event(
                function_names=["component.blue", "world"],
                filenames=["foo.js", "baz.js"],
                user_id=str(i),
            )
            for i in range(6)
        ][0].group.id
        top_5_issues = self.installation_impl.get_top_5_issues_by_count_for_file(
            projects=[self.project], sentry_filenames=["baz.js"], function_names=["world", "planet"]
        )
        top_5_issue_ids = [issue["group_id"] for issue in top_5_issues]
        function_names = [issue["function_name"] for issue in top_5_issues]
        assert top_5_issue_ids == [group_id_1, group_id_2]
        assert function_names == ["other.planet", "world"]

    def test_php_simple(self):
        # should match function name exactly or namespace::functionName
        group_id_1 = [
            self._create_event(
                function_names=["namespace/other/test::planet", "test/component::blue"],
                filenames=["baz.php", "foo.php"],
                user_id=str(i),
            )
            for i in range(7)
        ][0].group.id
        group_id_2 = [
            self._create_event(
                function_names=["test/component::blue", "world"],
                filenames=["foo.php", "baz.php"],
                user_id=str(i),
            )
            for i in range(6)
        ][0].group.id
        top_5_issues = self.installation_impl.get_top_5_issues_by_count_for_file(
            projects=[self.project],
            sentry_filenames=["baz.php"],
            function_names=["world", "planet"],
        )
        top_5_issue_ids = [issue["group_id"] for issue in top_5_issues]
        function_names = [issue["function_name"] for issue in top_5_issues]
        assert top_5_issue_ids == [group_id_1, group_id_2]
        assert function_names == ["namespace/other/test::planet", "world"]

    def test_ruby_simple(self):
        # should match function name exactly or class.functionName
        group_id_1 = [
            self._create_event(
                function_names=["test.planet", "test/component.blue"],
                filenames=["baz.rb", "foo.rb"],
                user_id=str(i),
            )
            for i in range(7)
        ][0].group.id
        group_id_2 = [
            self._create_event(
                function_names=["test/component.blue", "world"],
                filenames=["foo.rb", "baz.rb"],
                user_id=str(i),
            )
            for i in range(6)
        ][0].group.id
        top_5_issues = self.installation_impl.get_top_5_issues_by_count_for_file(
            projects=[self.project], sentry_filenames=["baz.rb"], function_names=["world", "planet"]
        )
        top_5_issue_ids = [issue["group_id"] for issue in top_5_issues]
        function_names = [issue["function_name"] for issue in top_5_issues]
        assert top_5_issue_ids == [group_id_1, group_id_2]
        assert function_names == ["test.planet", "world"]

    def test_filters_resolved_issue(self):
        group = Group.objects.all()[0]
        group.resolved_at = timezone.now()
        group.status = GroupStatus.RESOLVED
        group.substatus = None
        group.save()

        top_5_issues = self.installation_impl.get_top_5_issues_by_count_for_file(
            projects=[self.project], sentry_filenames=["baz.py"], function_names=["world"]
        )
        assert len(top_5_issues) == 0

    def test_filters_handled_issue(self):
        group_id = self._create_event(filenames=["bar.py", "baz.py"], handled=True).group.id

        top_5_issues = self.installation_impl.get_top_5_issues_by_count_for_file(
            projects=[self.project], sentry_filenames=["baz.py"], function_names=["world"]
        )
        top_5_issue_ids = [issue["group_id"] for issue in top_5_issues]
        assert group_id != self.group_id
        assert top_5_issue_ids == [self.group_id]

    def test_project_group_id_mismatch(self):
        # we fetch all group_ids that belong to the projects passed into the function
        self._create_event(project_id=self.another_org_project.id)

        top_5_issues = self.installation_impl.get_top_5_issues_by_count_for_file(
            projects=[self.project], sentry_filenames=["baz.py"], function_names=["world"]
        )
        top_5_issue_ids = [issue["group_id"] for issue in top_5_issues]
        assert top_5_issue_ids == [self.group_id]

    def test_filename_mismatch(self):
        group_id = self._create_event(
            filenames=["foo.py", "bar.py"],
        ).group.id

        top_5_issues = self.installation_impl.get_top_5_issues_by_count_for_file(
            projects=[self.project], sentry_filenames=["baz.py"], function_names=["world"]
        )
        top_5_issue_ids = [issue["group_id"] for issue in top_5_issues]
        assert group_id != self.group_id
        assert top_5_issue_ids == [self.group_id]

    def test_function_name_mismatch(self):
        group_id = self._create_event(
            function_names=["world", "hello"],
        ).group.id

        top_5_issues = self.installation_impl.get_top_5_issues_by_count_for_file(
            projects=[self.project], sentry_filenames=["baz.py"], function_names=["world"]
        )
        top_5_issue_ids = [issue["group_id"] for issue in top_5_issues]
        assert group_id != self.group_id
        assert top_5_issue_ids == [self.group_id]

    def test_not_first_frame(self):
        group_id = self._create_event(
            function_names=["world", "hello"], filenames=["baz.py", "bar.py"], culprit="hi"
        ).group.id

        top_5_issues = self.installation_impl.get_top_5_issues_by_count_for_file(
            projects=[self.project], sentry_filenames=["baz.py"], function_names=["world"]
        )
        top_5_issue_ids = [issue["group_id"] for issue in top_5_issues]
        function_names = [issue["function_name"] for issue in top_5_issues]
        assert group_id != self.group_id
        assert top_5_issue_ids == [self.group_id, group_id]
        assert function_names == ["world", "world"]

    def test_not_within_frame_limit(self):
        function_names = ["world"] + ["a" for _ in range(STACKFRAME_COUNT)]
        filenames = ["baz.py"] + ["foo.py" for _ in range(STACKFRAME_COUNT)]
        group_id = self._create_event(function_names=function_names, filenames=filenames).group.id

        top_5_issues = self.installation_impl.get_top_5_issues_by_count_for_file(
            projects=[self.project], sentry_filenames=["baz.py"], function_names=["world"]
        )
        top_5_issue_ids = [issue["group_id"] for issue in top_5_issues]
        assert group_id != self.group_id
        assert top_5_issue_ids == [self.group_id]

    def test_event_too_old(self):
        group_id = self._create_event(
            timestamp=before_now(days=15).isoformat(), filenames=["bar.py", "baz.py"]
        ).group.id

        top_5_issues = self.installation_impl.get_top_5_issues_by_count_for_file(
            projects=[self.project], sentry_filenames=["baz.py"], function_names=["world"]
        )
        top_5_issue_ids = [issue["group_id"] for issue in top_5_issues]
        assert group_id != self.group_id
        assert top_5_issue_ids == [self.group_id]

    def test_squashes_same_title_culprit_issues(self):
        # both of these have the same title and culprit,
        # so "squash" them and return the one with greater number of events
        [
            self._create_event(
                filenames=["base.py", "baz.py"],
                function_names=["wonderful", "world"],
                user_id=str(i),
                handled=False,
            )
            for i in range(3)
        ]
        group_id = [
            self._create_event(
                filenames=["bar.py", "baz.py"],
                function_names=["blue", "planet"],
                user_id=str(i),
                handled=False,
            )
            for i in range(5)
        ][0].group_id

        top_5_issues = self.installation_impl.get_top_5_issues_by_count_for_file(
            projects=[self.project], sentry_filenames=["baz.py"], function_names=["world", "planet"]
        )
        top_5_issue_ids = [issue["group_id"] for issue in top_5_issues]
        function_names = [issue["function_name"] for issue in top_5_issues]

        assert top_5_issue_ids == [self.group_id, group_id]
        assert function_names == ["world", "planet"]

    def test_fetches_top_five_issues(self):
        group_id_1 = [
            self._create_event(
                filenames=["bar.py", "baz.py"],
                function_names=["blue", "planet"],
                user_id=str(i),
                handled=False,
            )
            for i in range(5)
        ][0].group.id
        [
            self._create_event(
                filenames=["hello.py", "baz.py"],
                function_names=["green", "planet"],
                user_id=str(i),
                handled=True,
            )
            for i in range(4)
        ]
        group_id_3 = [
            self._create_event(
                filenames=["base.py", "baz.py"],
                function_names=["wonderful", "world"],
                user_id=str(i),
                handled=False,
                culprit="hi",
            )
            for i in range(3)
        ][0].group.id
        [
            self._create_event(
                filenames=["nom.py", "baz.py"],
                function_names=["jurassic", "world"],
                user_id=str(i),
                handled=True,
            )
            for i in range(2)
        ]
        # 6th issue
        self._create_event(
            filenames=["nan.py", "baz.py"], function_names=["my_own", "world"], handled=True
        )
        # unrelated issue with same stack trace in different project
        self._create_event(project_id=self.another_org_project.id)

        top_5_issues = self.installation_impl.get_top_5_issues_by_count_for_file(
            projects=[self.project], sentry_filenames=["baz.py"], function_names=["world", "planet"]
        )
        top_5_issue_ids = [issue["group_id"] for issue in top_5_issues]
        function_names = [issue["function_name"] for issue in top_5_issues]

        # filters handled issues
        assert top_5_issue_ids == [self.group_id, group_id_1, group_id_3]
        assert function_names == ["world", "planet", "world"]

    def test_get_issue_table_contents(self):
        group_id_1 = [
            self._create_event(
                culprit="issue1",
                filenames=["bar.py", "baz.py"],
                function_names=["blue", "planet"],
                user_id=str(i),
                handled=False,
            )
            for i in range(5)
        ][0].group.id
        group_id_2 = [
            self._create_event(
                culprit="issue2",
                filenames=["hello.py", "baz.py"],
                function_names=["green", "planet"],
                user_id=str(i),
                handled=False,
            )
            for i in range(4)
        ][0].group.id
        group_id_3 = [
            self._create_event(
                culprit="issue3",
                filenames=["base.py", "baz.py"],
                function_names=["wonderful", "world"],
                user_id=str(i),
                handled=False,
            )
            for i in range(3)
        ][0].group.id
        group_id_4 = [
            self._create_event(
                culprit="issue4",
                filenames=["nom.py", "baz.py"],
                function_names=["jurassic", "world"],
                user_id=str(i),
                handled=False,
            )
            for i in range(2)
        ][0].group.id

        top_5_issues = self.installation_impl.get_top_5_issues_by_count_for_file(
            projects=[self.project], sentry_filenames=["baz.py"], function_names=["world", "planet"]
        )
        affected_users = [6, 5, 4, 3, 2]
        event_count = [issue["event_count"] for issue in top_5_issues]
        function_names = [issue["function_name"] for issue in top_5_issues]

        comment_table_contents = self.installation_impl.get_issue_table_contents(top_5_issues)
        group_ids = [self.group_id, group_id_1, group_id_2, group_id_3, group_id_4]

        for i in range(5):
            subtitle = "issue" + str(i)
            assert (
                PullRequestIssue(
                    title="Error",
                    subtitle=subtitle,
                    url=f"http://testserver/organizations/{self.organization.slug}/issues/{group_ids[i]}/",
                    affected_users=affected_users[i],
                    event_count=event_count[i],
                    function_name=function_names[i],
                )
                in comment_table_contents
            )


class TestGetProjectsAndFilenamesFromSourceFile(TestCase):
    def setUp(self):
        super().setUp()

        self.repo = self.create_repo(
            name="getsentry/sentry",
            provider="integrations:mock_integration",
            integration_id=self.integration.id,
            project=self.project,
            url="https://github.com/getsentry/sentry",
        )

        self.another_org = self.create_organization()
        self.another_org_project = self.create_project(organization=self.another_org)
        self.another_org_integration = self.create_integration(
            organization=self.another_org, external_id="1", provider="mock_integration"
        )
        self.another_org_repo = self.create_repo(
            name="getsentry/sentree",
            provider="integrations:mock_integration",
            integration_id=self.another_org_integration.id,
            project=self.another_org_project,
            url="https://github.com/getsentry/sentree",
        )

        self.integration_impl = MockCommitContextIntegration()

    def test_get_projects_and_filenames_from_source_file(self):
        projects = [self.create_project() for _ in range(4)]

        source_stack_pairs = [
            ("", "./"),
            ("src/sentry", "sentry/"),
            ("src/", ""),
            ("src/sentry/", "sentry/"),
        ]
        for i, pair in enumerate(source_stack_pairs):
            source_root, stack_root = pair
            self.create_code_mapping(
                project=projects[i],
                repo=self.repo,
                source_root=source_root,
                stack_root=stack_root,
                default_branch="master",
            )

        # matching code mapping from a different org
        other_org_code_mapping = self.create_code_mapping(
            project=self.another_org_project,
            repo=self.another_org_repo,
            source_root="",
            stack_root="./",
        )
        other_org_code_mapping.organization_id = self.another_org.id
        other_org_code_mapping.save()

        source_stack_nonmatches = [
            ("/src/sentry", "sentry"),
            ("tests/", "tests/"),
            ("app/", "static/app"),
            ("tasks/integrations", "tasks"),  # random match in the middle of the string
        ]
        for source_root, stack_root in source_stack_nonmatches:
            self.create_code_mapping(
                project=self.create_project(),
                repo=self.repo,
                source_root=source_root,
                stack_root=stack_root,
                default_branch="master",
            )

        filename = "src/sentry/tasks/integrations/github/open_pr_comment.py"
        correct_filenames = [
            "./src/sentry/tasks/integrations/github/open_pr_comment.py",
            "sentry//tasks/integrations/github/open_pr_comment.py",
            "sentry/tasks/integrations/github/open_pr_comment.py",
        ]

        project_list, sentry_filenames = (
            self.integration_impl.get_projects_and_filenames_from_source_file(
                organization=self.organization, repo=self.repo, pr_filename=filename
            )
        )
        assert project_list == set(projects)
        assert sentry_filenames == set(correct_filenames)

    def test_get_projects_and_filenames_from_source_file_filters_repo(self):
        projects = [self.create_project() for _ in range(3)]

        source_stack_pairs = [
            ("src/sentry", "sentry/"),
            ("src/", ""),
            ("src/sentry/", "sentry/"),
        ]
        for i, pair in enumerate(source_stack_pairs):
            source_root, stack_root = pair
            self.create_code_mapping(
                project=projects[i],
                repo=self.repo,
                source_root=source_root,
                stack_root=stack_root,
                default_branch="master",
            )

        # other codemapping in different repo, will not match
        project = self.create_project()
        repo = self.create_repo(
            name="getsentry/santry",
            provider="integrations:github",
            integration_id=self.integration.id,
            project=project,
            url="https://github.com/getsentry/santry",
        )
        self.create_code_mapping(
            project=project,
            repo=repo,
            source_root="",
            stack_root="./",
            default_branch="master",
        )

        filename = "src/sentry/tasks/integrations/github/open_pr_comment.py"
        correct_filenames = [
            "sentry//tasks/integrations/github/open_pr_comment.py",
            "sentry/tasks/integrations/github/open_pr_comment.py",
        ]

        project_list, sentry_filenames = (
            self.integration_impl.get_projects_and_filenames_from_source_file(
                organization=self.organization, repo=self.repo, pr_filename=filename
            )
        )
        assert project_list == set(projects)
        assert sentry_filenames == set(correct_filenames)
