from typing import Any
from unittest.mock import patch

import pytest
import responses
from django.utils import timezone

from sentry.constants import ObjectStatus
from sentry.integrations.github.tasks.open_pr_comment import open_pr_comment_workflow
from sentry.integrations.models.integration import Integration
from sentry.integrations.source_code_management.commit_context import (
    PullRequestFile,
    PullRequestIssue,
)
from sentry.integrations.source_code_management.language_parsers import PATCH_PARSERS
from sentry.models.group import Group
from sentry.models.pullrequest import CommentType, PullRequest, PullRequestComment
from sentry.shared_integrations.exceptions import ApiError
from sentry.testutils.cases import IntegrationTestCase, TestCase
from sentry.testutils.helpers.datetime import before_now
from sentry.testutils.silo import assume_test_silo_mode_of
from sentry.testutils.skips import requires_snuba
from tests.sentry.integrations.github.tasks.test_pr_comment import GithubCommentTestCase

pytestmark = [requires_snuba]


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


class TestSafeForComment(GithubCommentTestCase):
    def setUp(self):
        super().setUp()
        self.pr = self.create_pr_issues()

        metrics_patch = patch("sentry.integrations.github.integration.metrics")
        self.mock_metrics = metrics_patch.start()
        self.addCleanup(metrics_patch.stop)

        self.gh_path = self.base_url + "/repos/getsentry/sentry/pulls/{pull_number}/files"
        self.installation_impl = self.integration.get_installation(
            organization_id=self.organization.id
        )

    @responses.activate
    def test_simple(self):
        data = [
            {"filename": "foo.py", "changes": 100, "status": "modified"},
            {"filename": "bar.js", "changes": 100, "status": "modified"},
            {"filename": "baz.py", "changes": 100, "status": "added"},
            {"filename": "bee.py", "changes": 100, "status": "deleted"},
            {"filename": "boo.js", "changes": 0, "status": "renamed"},
            {"filename": "bop.php", "changes": 100, "status": "modified"},
            {"filename": "doo.rb", "changes": 100, "status": "modified"},
        ]
        responses.add(
            responses.GET,
            self.gh_path.format(pull_number=self.pr.key),
            status=200,
            json=data,
        )

        pr_files = self.installation_impl.get_pr_files_safe_for_comment(
            repo=self.gh_repo, pr=self.pr
        )
        assert pr_files == [
            {"filename": "foo.py", "changes": 100, "status": "modified"},
            {"filename": "bar.js", "changes": 100, "status": "modified"},
            {"filename": "bop.php", "changes": 100, "status": "modified"},
            {"filename": "doo.rb", "changes": 100, "status": "modified"},
        ]

    @responses.activate
    def test_too_many_files(self):
        responses.add(
            responses.GET,
            self.gh_path.format(pull_number=self.pr.key),
            status=200,
            json=[
                {"filename": "a.py", "changes": 5, "status": "modified"},
                {"filename": "b.py", "changes": 5, "status": "modified"},
                {"filename": "c.py", "changes": 5, "status": "modified"},
                {"filename": "d.py", "changes": 5, "status": "modified"},
                {"filename": "e.py", "changes": 5, "status": "modified"},
                {"filename": "f.py", "changes": 5, "status": "modified"},
                {"filename": "g.py", "changes": 5, "status": "modified"},
                {"filename": "h.py", "changes": 5, "status": "modified"},
                {"filename": "i.py", "changes": 5, "status": "modified"},
            ],
        )

        pr_files = self.installation_impl.get_pr_files_safe_for_comment(
            repo=self.gh_repo, pr=self.pr
        )
        assert pr_files == []  # not safe
        self.mock_metrics.incr.assert_called_with(
            "github.open_pr_comment.rejected_comment", tags={"reason": "too_many_files"}
        )

    @responses.activate
    def test_too_many_lines(self):
        responses.add(
            responses.GET,
            self.gh_path.format(pull_number=self.pr.key),
            status=200,
            json=[
                {"filename": "foo.py", "changes": 300, "status": "modified"},
                {"filename": "bar.py", "changes": 300, "status": "modified"},
            ],
        )

        pr_files = self.installation_impl.get_pr_files_safe_for_comment(
            repo=self.gh_repo, pr=self.pr
        )
        assert pr_files == []  # not safe
        self.mock_metrics.incr.assert_called_with(
            "github.open_pr_comment.rejected_comment", tags={"reason": "too_many_lines"}
        )

    @responses.activate
    def test_too_many_files_and_lines(self):
        responses.add(
            responses.GET,
            self.gh_path.format(pull_number=self.pr.key),
            status=200,
            json=[
                {"filename": "a.py", "changes": 100, "status": "modified"},
                {"filename": "b.py", "changes": 100, "status": "modified"},
                {"filename": "c.py", "changes": 100, "status": "modified"},
                {"filename": "d.py", "changes": 100, "status": "modified"},
                {"filename": "e.py", "changes": 100, "status": "modified"},
                {"filename": "f.py", "changes": 100, "status": "modified"},
                {"filename": "g.py", "changes": 100, "status": "modified"},
                {"filename": "h.py", "changes": 100, "status": "modified"},
                {"filename": "i.py", "changes": 100, "status": "modified"},
            ],
        )

        pr_files = self.installation_impl.get_pr_files_safe_for_comment(
            repo=self.gh_repo, pr=self.pr
        )
        assert pr_files == []  # not safe
        self.mock_metrics.incr.assert_any_call(
            "github.open_pr_comment.rejected_comment", tags={"reason": "too_many_lines"}
        )

    @responses.activate
    def test_error__rate_limited(self):
        responses.add(
            responses.GET,
            self.gh_path.format(pull_number=self.pr.key),
            status=429,
            json={
                "message": "API rate limit exceeded",
                "documentation_url": "https://docs.github.com/rest/overview/resources-in-the-rest-api#rate-limiting",
            },
        )

        pr_files = self.installation_impl.get_pr_files_safe_for_comment(
            repo=self.gh_repo, pr=self.pr
        )
        assert pr_files == []  # not safe
        self.mock_metrics.incr.assert_called_with(
            "github.open_pr_comment.api_error", tags={"type": "gh_rate_limited", "code": 429}
        )

    @responses.activate
    def test_error__missing_pr(self):
        responses.add(
            responses.GET, self.gh_path.format(pull_number=self.pr.key), status=404, json={}
        )

        pr_files = self.installation_impl.get_pr_files_safe_for_comment(
            repo=self.gh_repo, pr=self.pr
        )
        assert pr_files == []  # not safe
        self.mock_metrics.incr.assert_called_with(
            "github.open_pr_comment.api_error",
            tags={"type": "missing_gh_pull_request", "code": 404},
        )

    @responses.activate
    def test_error__api_error(self):
        responses.add(
            responses.GET, self.gh_path.format(pull_number=self.pr.key), status=400, json={}
        )

        pr_files = self.installation_impl.get_pr_files_safe_for_comment(
            repo=self.gh_repo, pr=self.pr
        )
        assert pr_files == []  # not safe
        self.mock_metrics.incr.assert_called_with(
            "github.open_pr_comment.api_error", tags={"type": "unknown_api_error", "code": 400}
        )


class TestGetFilenames(GithubCommentTestCase):
    def setUp(self):
        super().setUp()
        self.pr = self.create_pr_issues()

        metrics_patch = patch("sentry.integrations.source_code_management.commit_context.metrics")
        self.mock_metrics = metrics_patch.start()
        self.addCleanup(metrics_patch.stop)

        self.gh_path = self.base_url + "/repos/getsentry/sentry/pulls/{pull_number}/files"
        self.installation_impl = self.integration.get_installation(
            organization_id=self.organization.id
        )
        self.gh_client = self.installation_impl.get_client()

    @responses.activate
    def test_get_pr_files(self):
        data: Any = [
            {"filename": "bar.py", "status": "modified", "patch": "b"},
            {"filename": "baz.py", "status": "modified"},
        ]

        pr_files = self.installation_impl.get_pr_files(data)
        assert len(pr_files) == 1

        pr_file = pr_files[0]
        assert pr_file.filename == data[0]["filename"]
        assert pr_file.patch == data[0]["patch"]


class TestFormatComment(TestCase):
    def setUp(self):
        super().setUp()
        self.installation_impl = self.integration.get_installation(
            organization_id=self.organization.id
        )

    def test_comment_format_python(self):
        file1 = "tests/sentry/tasks/integrations/github/test_open_pr_comment.py"
        file1_issues = [
            PullRequestIssue(
                title="file1 " + str(i),
                subtitle="subtitle" + str(i),
                url=f"http://testserver/organizations/{self.organization.slug}/issues/{str(i)}/",
                affected_users=(5 - i) * 1000,
                event_count=(5 - i) * 1000,
                function_name="function_" + str(i),
            )
            for i in range(5)
        ]
        file2 = "tests/sentry/tasks/integrations/github/test_pr_comment.py"

        # test truncating the issue description
        file2_issues = [
            PullRequestIssue(
                title="SoftTimeLimitExceeded " + str(i),
                subtitle="sentry.tasks.low_priority_symbolication.scan_for_suspect" + str(i),
                url=f"http://testserver/organizations/{self.organization.slug}/issues/{str(i+5)}/",
                affected_users=(2 - i) * 10000,
                event_count=(2 - i) * 10000,
                function_name="function_" + str(i),
            )
            for i in range(2)
        ]

        issue_table = self.installation_impl.format_issue_table(
            file1, file1_issues, PATCH_PARSERS, toggle=False
        )
        toggle_issue_table = self.installation_impl.format_issue_table(
            file2, file2_issues, PATCH_PARSERS, toggle=True
        )
        comment = self.installation_impl.format_open_pr_comment([issue_table, toggle_issue_table])

        assert (
            comment
            == """## 🔍 Existing Issues For Review
Your pull request is modifying functions with the following pre-existing issues:

📄 File: **tests/sentry/tasks/integrations/github/test_open_pr_comment.py**

| Function | Unhandled Issue |
| :------- | :----- |
| **`function_0`** | [**file1 0**](http://testserver/organizations/baz/issues/0/?referrer=github-open-pr-bot) subtitle0 <br> `Event Count:` **5k** |
| **`function_1`** | [**file1 1**](http://testserver/organizations/baz/issues/1/?referrer=github-open-pr-bot) subtitle1 <br> `Event Count:` **4k** |
| **`function_2`** | [**file1 2**](http://testserver/organizations/baz/issues/2/?referrer=github-open-pr-bot) subtitle2 <br> `Event Count:` **3k** |
| **`function_3`** | [**file1 3**](http://testserver/organizations/baz/issues/3/?referrer=github-open-pr-bot) subtitle3 <br> `Event Count:` **2k** |
| **`function_4`** | [**file1 4**](http://testserver/organizations/baz/issues/4/?referrer=github-open-pr-bot) subtitle4 <br> `Event Count:` **1k** |
<details>
<summary><b>📄 File: tests/sentry/tasks/integrations/github/test_pr_comment.py (Click to Expand)</b></summary>

| Function | Unhandled Issue |
| :------- | :----- |
| **`function_0`** | [**SoftTimeLimitExceeded 0**](http://testserver/organizations/baz/issues/5/?referrer=github-open-pr-bot) sentry.tasks.low_priority... <br> `Event Count:` **20k** |
| **`function_1`** | [**SoftTimeLimitExceeded 1**](http://testserver/organizations/baz/issues/6/?referrer=github-open-pr-bot) sentry.tasks.low_priority... <br> `Event Count:` **10k** |
</details>
---

<sub>Did you find this useful? React with a 👍 or 👎</sub>"""
        )

    def test_comment_format_javascript(self):
        file1 = "tests/sentry/tasks/integrations/github/test_open_pr_comment.js"
        file1_issues = [
            PullRequestIssue(
                title="file1 " + str(i),
                subtitle="subtitle" + str(i),
                url=f"http://testserver/organizations/{self.organization.slug}/issues/{str(i)}/",
                affected_users=(5 - i) * 1000,
                event_count=(5 - i) * 1000,
                function_name="function_" + str(i),
            )
            for i in range(5)
        ]
        file2 = "tests/sentry/tasks/integrations/github/test_pr_comment.js"

        # test truncating the issue description
        file2_issues = [
            PullRequestIssue(
                title="SoftTimeLimitExceeded " + str(i),
                subtitle="sentry.tasks.low_priority_symbolication.scan_for_suspect" + str(i),
                url=f"http://testserver/organizations/{self.organization.slug}/issues/{str(i+5)}/",
                affected_users=(2 - i) * 10000,
                event_count=(2 - i) * 10000,
                function_name="function_" + str(i),
            )
            for i in range(2)
        ]

        issue_table = self.installation_impl.format_issue_table(
            file1, file1_issues, PATCH_PARSERS, toggle=False
        )
        toggle_issue_table = self.installation_impl.format_issue_table(
            file2, file2_issues, PATCH_PARSERS, toggle=True
        )
        comment = self.installation_impl.format_open_pr_comment([issue_table, toggle_issue_table])

        assert (
            comment
            == """## 🔍 Existing Issues For Review
Your pull request is modifying functions with the following pre-existing issues:

📄 File: **tests/sentry/tasks/integrations/github/test_open_pr_comment.js**

| Function | Unhandled Issue |
| :------- | :----- |
| **`function_0`** | [**file1 0**](http://testserver/organizations/baz/issues/0/?referrer=github-open-pr-bot) subtitle0 <br> `Event Count:` **5k** `Affected Users:` **5k** |
| **`function_1`** | [**file1 1**](http://testserver/organizations/baz/issues/1/?referrer=github-open-pr-bot) subtitle1 <br> `Event Count:` **4k** `Affected Users:` **4k** |
| **`function_2`** | [**file1 2**](http://testserver/organizations/baz/issues/2/?referrer=github-open-pr-bot) subtitle2 <br> `Event Count:` **3k** `Affected Users:` **3k** |
| **`function_3`** | [**file1 3**](http://testserver/organizations/baz/issues/3/?referrer=github-open-pr-bot) subtitle3 <br> `Event Count:` **2k** `Affected Users:` **2k** |
| **`function_4`** | [**file1 4**](http://testserver/organizations/baz/issues/4/?referrer=github-open-pr-bot) subtitle4 <br> `Event Count:` **1k** `Affected Users:` **1k** |
<details>
<summary><b>📄 File: tests/sentry/tasks/integrations/github/test_pr_comment.js (Click to Expand)</b></summary>

| Function | Unhandled Issue |
| :------- | :----- |
| **`function_0`** | [**SoftTimeLimitExceeded 0**](http://testserver/organizations/baz/issues/5/?referrer=github-open-pr-bot) sentry.tasks.low_priority... <br> `Event Count:` **20k** `Affected Users:` **20k** |
| **`function_1`** | [**SoftTimeLimitExceeded 1**](http://testserver/organizations/baz/issues/6/?referrer=github-open-pr-bot) sentry.tasks.low_priority... <br> `Event Count:` **10k** `Affected Users:` **10k** |
</details>
---

<sub>Did you find this useful? React with a 👍 or 👎</sub>"""
        )

    def test_comment_format_missing_language(self):
        file1 = "tests/sentry/tasks/integrations/github/test_open_pr_comment.docx"

        issue_table = self.installation_impl.format_issue_table(
            file1, [], PATCH_PARSERS, toggle=False
        )

        assert issue_table == ""


@patch("sentry.integrations.github.integration.GitHubIntegration.get_pr_files")
@patch(
    "sentry.integrations.github.integration.GitHubIntegration.get_projects_and_filenames_from_source_file"
)
@patch(
    "sentry.integrations.source_code_management.language_parsers.PythonParser.extract_functions_from_patch"
)
@patch(
    "sentry.integrations.github.integration.GitHubIntegration.get_top_5_issues_by_count_for_file"
)
@patch("sentry.integrations.github.integration.GitHubIntegration.get_pr_files_safe_for_comment")
@patch("sentry.integrations.source_code_management.commit_context.metrics")
class TestOpenPRCommentWorkflow(IntegrationTestCase, CreateEventTestCase):
    base_url = "https://api.github.com"

    def setUp(self):
        self.user_id = "user_1"
        self.app_id = "app_1"

        self.group_id_1 = [self._create_event(culprit="issue1", user_id=str(i)) for i in range(5)][
            0
        ].group.id
        self.group_id_2 = [
            self._create_event(
                culprit="issue2",
                filenames=["foo.py", "bar.py"],
                function_names=["blue", "planet"],
                user_id=str(i),
            )
            for i in range(6)
        ][0].group.id

        self.gh_repo = self.create_repo(
            name="getsentry/sentry",
            provider="integrations:github",
            integration_id=self.integration.id,
            project=self.project,
            url="https://github.com/getsentry/sentry",
        )
        self.pr = PullRequest.objects.create(
            organization_id=self.organization.id,
            repository_id=self.gh_repo.id,
            key=str(1),
        )
        self.groups = [
            {
                "group_id": g.id,
                "event_count": 1000 * (i + 1),
                "function_name": "function_" + str(i),
            }
            for i, g in enumerate(Group.objects.all())
        ]
        self.groups.reverse()

    @responses.activate
    @patch("sentry.analytics.record")
    def test_comment_workflow(
        self,
        mock_analytics,
        mock_metrics,
        mock_safe_for_comment,
        mock_issues,
        mock_function_names,
        mock_reverse_codemappings,
        mock_pr_filenames,
    ):
        mock_safe_for_comment.return_value = [{}]
        # two filenames, the second one has a toggle table
        mock_pr_filenames.return_value = [
            PullRequestFile(filename="foo.py", patch="a"),
            PullRequestFile(filename="bar.py", patch="b"),
        ]
        mock_reverse_codemappings.return_value = ([self.project], ["foo.py"])
        mock_function_names.return_value = ["world", "planet"]

        mock_issues.return_value = self.groups

        responses.add(
            responses.POST,
            self.base_url + "/repos/getsentry/sentry/issues/1/comments",
            json={"id": 1},
            headers={"X-Ratelimit-Limit": "60", "X-Ratelimit-Remaining": "59"},
        )

        open_pr_comment_workflow(self.pr.id)

        assert (
            f'"body": "## \\ud83d\\udd0d Existing Issues For Review\\nYour pull request is modifying functions with the following pre-existing issues:\\n\\n\\ud83d\\udcc4 File: **foo.py**\\n\\n| Function | Unhandled Issue |\\n| :------- | :----- |\\n| **`function_1`** | [**Error**](http://testserver/organizations/baz/issues/{self.group_id_2}/?referrer=github-open-pr-bot) issue2 <br> `Event Count:` **2k** |\\n| **`function_0`** | [**Error**](http://testserver/organizations/baz/issues/{self.group_id_1}/?referrer=github-open-pr-bot) issue1 <br> `Event Count:` **1k** |\\n<details>\\n<summary><b>\\ud83d\\udcc4 File: bar.py (Click to Expand)</b></summary>\\n\\n| Function | Unhandled Issue |\\n| :------- | :----- |\\n| **`function_1`** | [**Error**](http://testserver/organizations/baz/issues/{self.group_id_2}/?referrer=github-open-pr-bot) issue2 <br> `Event Count:` **2k** |\\n| **`function_0`** | [**Error**](http://testserver/organizations/baz/issues/{self.group_id_1}/?referrer=github-open-pr-bot) issue1 <br> `Event Count:` **1k** |\\n</details>\\n---\\n\\n<sub>Did you find this useful? React with a \\ud83d\\udc4d or \\ud83d\\udc4e</sub>"'.encode()
            in responses.calls[0].request.body
        )

        pull_request_comment_query = PullRequestComment.objects.all()
        assert len(pull_request_comment_query) == 1
        comment = pull_request_comment_query[0]
        assert comment.external_id == 1
        assert comment.comment_type == CommentType.OPEN_PR

        mock_metrics.incr.assert_called_with("github.open_pr_comment.comment_created")
        mock_analytics.assert_any_call(
            "open_pr_comment.created",
            comment_id=comment.id,
            org_id=self.organization.id,
            pr_id=comment.pull_request.id,
            language="python",
        )

    @responses.activate
    @patch("sentry.analytics.record")
    def test_comment_workflow_comment_exists(
        self,
        mock_analytics,
        mock_metrics,
        mock_safe_for_comment,
        mock_issues,
        mock_function_names,
        mock_reverse_codemappings,
        mock_pr_filenames,
    ):
        mock_safe_for_comment.return_value = [{}]
        # two filenames, the second one has a toggle table
        mock_pr_filenames.return_value = [
            PullRequestFile(filename="foo.py", patch="a"),
            PullRequestFile(filename="bar.py", patch="b"),
        ]
        mock_reverse_codemappings.return_value = ([self.project], ["foo.py"])
        mock_function_names.return_value = ["world", "planet"]

        mock_issues.return_value = self.groups

        now = timezone.now()
        PullRequestComment.objects.create(
            external_id=1,
            pull_request=self.pr,
            created_at=now,
            updated_at=now,
            group_ids=[0, 1],
            comment_type=CommentType.OPEN_PR,
        )

        responses.add(
            responses.PATCH,
            self.base_url + "/repos/getsentry/sentry/issues/comments/1",
            json={"id": 1},
            headers={"X-Ratelimit-Limit": "60", "X-Ratelimit-Remaining": "59"},
        )

        open_pr_comment_workflow(self.pr.id)

        pull_request_comment_query = PullRequestComment.objects.all()
        pr_comment = pull_request_comment_query[0]
        assert len(pull_request_comment_query) == 1
        assert pr_comment.external_id == 1
        assert pr_comment.comment_type == CommentType.OPEN_PR
        assert pr_comment.created_at != pr_comment.updated_at

        mock_metrics.incr.assert_called_with("github.open_pr_comment.comment_updated")
        assert not mock_analytics.called

    @patch("sentry.analytics.record")
    @responses.activate
    def test_comment_workflow_early_return(
        self,
        mock_analytics,
        mock_metrics,
        mock_safe_for_comment,
        mock_issues,
        mock_function_names,
        mock_reverse_codemappings,
        mock_pr_filenames,
    ):
        # no python files
        mock_safe_for_comment.return_value = []
        open_pr_comment_workflow(self.pr.id)

        pull_request_comment_query = PullRequestComment.objects.all()
        assert len(pull_request_comment_query) == 0
        mock_metrics.incr.assert_called_with(
            "github.open_pr_comment.error", tags={"type": "unsafe_for_comment"}
        )

        mock_safe_for_comment.return_value = [{}]
        mock_pr_filenames.return_value = [
            PullRequestFile(filename="foo.py", patch="a"),
        ]
        # no codemappings
        mock_reverse_codemappings.return_value = ([], [])

        open_pr_comment_workflow(self.pr.id)

        pull_request_comment_query = PullRequestComment.objects.all()
        assert len(pull_request_comment_query) == 0
        mock_metrics.incr.assert_called_with("github.open_pr_comment.no_issues")

        # has codemappings but no functions in diff
        mock_reverse_codemappings.return_value = ([self.project], ["foo.py"])
        mock_function_names.return_value = []

        open_pr_comment_workflow(self.pr.id)

        pull_request_comment_query = PullRequestComment.objects.all()
        assert len(pull_request_comment_query) == 0
        mock_metrics.incr.assert_called_with("github.open_pr_comment.no_issues")

        # has codemappings and functions but no issues
        mock_function_names.return_value = ["world"]
        open_pr_comment_workflow(self.pr.id)

        pull_request_comment_query = PullRequestComment.objects.all()
        assert len(pull_request_comment_query) == 0

        mock_metrics.incr.assert_called_with("github.open_pr_comment.no_issues")
        assert not mock_analytics.called

    @patch("sentry.analytics.record")
    @patch("sentry.integrations.github.integration.metrics")
    @responses.activate
    def test_comment_workflow_api_error(
        self,
        mock_integration_metrics,
        mock_analytics,
        mock_metrics,
        mock_safe_for_comment,
        mock_issues,
        mock_function_names,
        mock_reverse_codemappings,
        mock_pr_filenames,
    ):
        mock_safe_for_comment.return_value = [{}]
        mock_pr_filenames.return_value = [
            PullRequestFile(filename="foo.py", patch="a"),
        ]
        mock_reverse_codemappings.return_value = ([self.project], ["foo.py"])
        mock_function_names.return_value = ["world"]

        mock_issues.return_value = self.groups

        responses.add(
            responses.POST,
            self.base_url + "/repos/getsentry/sentry/issues/1/comments",
            status=400,
            json={"id": 1},
        )
        responses.add(
            responses.POST,
            self.base_url + "/repos/getsentry/sentry/issues/2/comments",
            status=400,
            json={
                "message": "Unable to create comment because issue is locked.",
                "documentation_url": "https://docs.github.com/articles/locking-conversations/",
            },
        )
        responses.add(
            responses.POST,
            self.base_url + "/repos/getsentry/sentry/issues/3/comments",
            status=400,
            json={
                "message": "API rate limit exceeded",
                "documentation_url": "https://docs.github.com/rest/overview/resources-in-the-rest-api#rate-limiting",
            },
        )

        with pytest.raises(ApiError):
            open_pr_comment_workflow(self.pr.id)
        mock_metrics.incr.assert_called_with(
            "github.open_pr_comment.error", tags={"type": "api_error"}
        )

        pr_2 = PullRequest.objects.create(
            organization_id=self.organization.id,
            repository_id=self.gh_repo.id,
            key=str(2),
        )

        # does not raise ApiError for locked issue
        open_pr_comment_workflow(pr_2.id)
        mock_integration_metrics.incr.assert_called_with(
            "github.open_pr_comment.error", tags={"type": "issue_locked_error"}
        )

        pr_3 = PullRequest.objects.create(
            organization_id=self.organization.id,
            repository_id=self.gh_repo.id,
            key=str(3),
        )

        # does not raise ApiError for rate limited error
        open_pr_comment_workflow(pr_3.id)
        mock_integration_metrics.incr.assert_called_with(
            "github.open_pr_comment.error", tags={"type": "rate_limited_error"}
        )
        assert not mock_analytics.called

    def test_comment_workflow_missing_pr(
        self,
        mock_metrics,
        mock_safe_for_comment,
        mock_issues,
        mock_function_names,
        mock_reverse_codemappings,
        mock_pr_filenames,
    ):
        PullRequest.objects.all().delete()

        open_pr_comment_workflow(0)

        assert not mock_pr_filenames.called
        mock_metrics.incr.assert_called_with(
            "github.open_pr_comment.error", tags={"type": "missing_pr"}
        )

    def test_comment_workflow_missing_org(
        self,
        mock_metrics,
        mock_safe_for_comment,
        mock_issues,
        mock_function_names,
        mock_reverse_codemappings,
        mock_pr_filenames,
    ):
        self.pr.organization_id = 0
        self.pr.save()

        open_pr_comment_workflow(self.pr.id)

        assert not mock_pr_filenames.called
        mock_metrics.incr.assert_called_with(
            "github.open_pr_comment.error", tags={"type": "missing_org"}
        )

    def test_comment_workflow_missing_repo(
        self,
        mock_metrics,
        mock_safe_for_comment,
        mock_issues,
        mock_function_names,
        mock_reverse_codemappings,
        mock_pr_filenames,
    ):
        self.pr.repository_id = 0
        self.pr.save()

        open_pr_comment_workflow(self.pr.id)

        assert not mock_pr_filenames.called
        mock_metrics.incr.assert_called_with(
            "github.open_pr_comment.error", tags={"type": "missing_repo"}
        )

    def test_comment_workflow_missing_integration(
        self,
        mock_metrics,
        mock_safe_for_comment,
        mock_issues,
        mock_function_names,
        mock_reverse_codemappings,
        mock_pr_filenames,
    ):
        # inactive integration
        with assume_test_silo_mode_of(Integration):
            self.integration.update(status=ObjectStatus.DISABLED)

        open_pr_comment_workflow(self.pr.id)

        assert not mock_pr_filenames.called
        mock_metrics.incr.assert_called_with(
            "github.open_pr_comment.error", tags={"type": "missing_integration"}
        )

    def test_comment_workflow_not_safe_for_comment(
        self,
        mock_metrics,
        mock_safe_for_comment,
        mock_issues,
        mock_function_names,
        mock_reverse_codemappings,
        mock_pr_filenames,
    ):
        mock_safe_for_comment.return_value = []
        open_pr_comment_workflow(self.pr.id)

        assert not mock_pr_filenames.called
        mock_metrics.incr.assert_called_with(
            "github.open_pr_comment.error", tags={"type": "unsafe_for_comment"}
        )
