from unittest.mock import patch

import pytest
import responses
from django.utils import timezone

from sentry.models.group import Group, GroupStatus
from sentry.models.options.organization_option import OrganizationOption
from sentry.models.pullrequest import CommentType, PullRequest, PullRequestComment
from sentry.shared_integrations.exceptions import ApiError
from sentry.tasks.integrations.github.open_pr_comment import (
    format_issue_table,
    format_open_pr_comment,
    get_issue_table_contents,
    get_pr_filenames,
    get_projects_and_filenames_from_source_file,
    get_top_5_issues_by_count_for_file,
    open_pr_comment_workflow,
    safe_for_comment,
)
from sentry.tasks.integrations.github.pr_comment import PullRequestIssue
from sentry.testutils.cases import IntegrationTestCase, TestCase
from sentry.testutils.helpers.datetime import before_now, iso_format
from sentry.testutils.silo import region_silo_test
from sentry.testutils.skips import requires_snuba
from sentry.utils.json import JSONData
from tests.sentry.tasks.integrations.github.test_pr_comment import GithubCommentTestCase

pytestmark = [requires_snuba]


class CreateEventTestCase(TestCase):
    def _create_event(
        self,
        culprit=None,
        timestamp=None,
        filenames=None,
        project_id=None,
        user_id=None,
        handled=False,
    ):
        if culprit is None:
            culprit = "issue0"
        if timestamp is None:
            timestamp = iso_format(before_now(seconds=5))
        if filenames is None:
            filenames = ["foo.py", "baz.py"]
        if project_id is None:
            project_id = self.project.id

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
                                "frames": [{"filename": filename} for filename in filenames],
                            },
                            "mechanism": {"handled": handled, "type": "generic"},
                        },
                    ]
                },
                "user": {"id": user_id},
            },
            project_id=project_id,
        )


@region_silo_test
class TestSafeForComment(GithubCommentTestCase):
    def setUp(self):
        super().setUp()
        self.pr = self.create_pr_issues()
        self.mock_metrics = patch(
            "sentry.tasks.integrations.github.open_pr_comment.metrics"
        ).start()
        self.gh_path = self.base_url + "/repos/getsentry/sentry/pulls/{pull_number}/files"
        installation = self.integration.get_installation(organization_id=self.organization.id)
        self.gh_client = installation.get_client()

    @responses.activate
    def test_simple(self):
        data = [
            {"filename": "foo.py", "changes": 100, "status": "modified"},
            {"filename": "bar.js", "changes": 100, "status": "modified"},
            {"filename": "baz.py", "changes": 100, "status": "added"},
            {"filename": "bee.py", "changes": 100, "status": "deleted"},
        ]
        responses.add(
            responses.GET,
            self.gh_path.format(pull_number=self.pr.key),
            status=200,
            json=data,
        )

        is_safe, pr_files = safe_for_comment(self.gh_client, self.gh_repo, self.pr)
        assert is_safe
        assert pr_files == data

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

        is_safe, pr_files = safe_for_comment(self.gh_client, self.gh_repo, self.pr)
        assert not is_safe
        assert pr_files == []
        self.mock_metrics.incr.assert_called_with(
            "github_open_pr_comment.rejected_comment", tags={"reason": "too_many_files"}
        )

    @responses.activate
    def test_too_many_lines(self):
        responses.add(
            responses.GET,
            self.gh_path.format(pull_number=self.pr.key),
            status=200,
            json=[
                {"filename": "foo.py", "changes": 300, "status": "modified"},
                {"filename": "bar.py", "changes": 300, "status": "deleted"},
            ],
        )

        is_safe, pr_files = safe_for_comment(self.gh_client, self.gh_repo, self.pr)
        assert not is_safe
        assert pr_files == []
        self.mock_metrics.incr.assert_called_with(
            "github_open_pr_comment.rejected_comment", tags={"reason": "too_many_lines"}
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

        is_safe, pr_files = safe_for_comment(self.gh_client, self.gh_repo, self.pr)
        assert not is_safe
        assert pr_files == []
        self.mock_metrics.incr.assert_any_call(
            "github_open_pr_comment.rejected_comment", tags={"reason": "too_many_lines"}
        )
        self.mock_metrics.incr.assert_any_call(
            "github_open_pr_comment.rejected_comment", tags={"reason": "too_many_files"}
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

        is_safe, pr_files = safe_for_comment(self.gh_client, self.gh_repo, self.pr)
        assert not is_safe
        assert pr_files == []
        self.mock_metrics.incr.assert_called_with(
            "github_open_pr_comment.api_error", tags={"type": "gh_rate_limited", "code": 429}
        )

    @responses.activate
    def test_error__missing_pr(self):
        responses.add(
            responses.GET, self.gh_path.format(pull_number=self.pr.key), status=404, json={}
        )

        is_safe, pr_files = safe_for_comment(self.gh_client, self.gh_repo, self.pr)
        assert not is_safe
        assert pr_files == []
        self.mock_metrics.incr.assert_called_with(
            "github_open_pr_comment.api_error",
            tags={"type": "missing_gh_pull_request", "code": 404},
        )

    @responses.activate
    def test_error__api_error(self):
        responses.add(
            responses.GET, self.gh_path.format(pull_number=self.pr.key), status=400, json={}
        )

        is_safe, pr_files = safe_for_comment(self.gh_client, self.gh_repo, self.pr)
        assert not is_safe
        assert pr_files == []
        self.mock_metrics.incr.assert_called_with(
            "github_open_pr_comment.api_error", tags={"type": "unknown_api_error", "code": 400}
        )


@region_silo_test
class TestGetFilenames(GithubCommentTestCase):
    def setUp(self):
        super().setUp()
        self.pr = self.create_pr_issues()
        self.mock_metrics = patch("sentry.tasks.integrations.github.pr_comment.metrics").start()
        self.gh_path = self.base_url + "/repos/getsentry/sentry/pulls/{pull_number}/files"
        installation = self.integration.get_installation(organization_id=self.organization.id)
        self.gh_client = installation.get_client()

    @responses.activate
    def test_get_pr_filenames(self):
        data: JSONData = [
            {"filename": "foo.py", "status": "added"},
            {"filename": "bar.py", "status": "modified"},
            {"filename": "baz.py", "status": "deleted"},
            {"filename": "bee.js", "status": "modified"},
        ]

        assert set(get_pr_filenames(data)) == {"bar.py", "baz.py"}

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
                repo=self.gh_repo,
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
        other_org_code_mapping.organization_id = self.another_organization.id
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
                repo=self.gh_repo,
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

        project_list, sentry_filenames = get_projects_and_filenames_from_source_file(
            self.organization.id, filename
        )
        assert project_list == set(projects)
        assert sentry_filenames == set(correct_filenames)


@region_silo_test
class TestGetCommentIssues(CreateEventTestCase):
    def setUp(self):
        self.group_id = [self._create_event(user_id=str(i)) for i in range(6)][0].group.id
        self.another_org = self.create_organization()
        self.another_org_project = self.create_project(organization=self.another_org)

    def test_simple(self):
        top_5_issues = get_top_5_issues_by_count_for_file([self.project], ["baz.py"])
        top_5_issue_ids = [issue["group_id"] for issue in top_5_issues]
        assert top_5_issue_ids == [self.group_id]

    def test_filters_resolved_issue(self):
        group = Group.objects.all()[0]
        group.resolved_at = timezone.now()
        group.status = GroupStatus.RESOLVED
        group.save()

        top_5_issues = get_top_5_issues_by_count_for_file([self.project], ["baz.py"])
        assert len(top_5_issues) == 0

    def test_filters_handled_issue(self):
        group_id = self._create_event(filenames=["bar.py", "baz.py"], handled=True).group.id

        top_5_issues = get_top_5_issues_by_count_for_file([self.project], ["baz.py"])
        top_5_issue_ids = [issue["group_id"] for issue in top_5_issues]
        assert group_id != self.group_id
        assert top_5_issue_ids == [self.group_id]

    def test_project_group_id_mismatch(self):
        # we fetch all group_ids that belong to the projects passed into the function
        self._create_event(project_id=self.another_org_project.id)

        top_5_issues = get_top_5_issues_by_count_for_file([self.project], ["baz.py"])
        top_5_issue_ids = [issue["group_id"] for issue in top_5_issues]
        assert top_5_issue_ids == [self.group_id]

    def test_filename_mismatch(self):
        group_id = self._create_event(
            filenames=["foo.py", "bar.py"],
        ).group.id

        top_5_issues = get_top_5_issues_by_count_for_file([self.project], ["baz.py"])
        top_5_issue_ids = [issue["group_id"] for issue in top_5_issues]
        assert group_id != self.group_id
        assert top_5_issue_ids == [self.group_id]

    def test_event_too_old(self):
        group_id = self._create_event(
            timestamp=iso_format(before_now(days=15)), filenames=["bar.py", "baz.py"]
        ).group.id

        top_5_issues = get_top_5_issues_by_count_for_file([self.project], ["baz.py"])
        top_5_issue_ids = [issue["group_id"] for issue in top_5_issues]
        assert group_id != self.group_id
        assert top_5_issue_ids == [self.group_id]

    def test_fetches_top_five_issues(self):
        group_id_1 = [
            self._create_event(filenames=["bar.py", "baz.py"], user_id=str(i), handled=False)
            for i in range(5)
        ][0].group.id
        [
            self._create_event(filenames=["hello.py", "baz.py"], user_id=str(i), handled=True)
            for i in range(4)
        ]
        group_id_3 = [
            self._create_event(filenames=["base.py", "baz.py"], user_id=str(i), handled=False)
            for i in range(3)
        ][0].group.id
        [
            self._create_event(filenames=["nom.py", "baz.py"], user_id=str(i), handled=True)
            for i in range(2)
        ]
        # 6th issue
        self._create_event(filenames=["nan.py", "baz.py"], handled=True)
        # unrelated issue with same stack trace in different project
        self._create_event(project_id=self.another_org_project.id)

        top_5_issues = get_top_5_issues_by_count_for_file([self.project], ["baz.py"])
        top_5_issue_ids = [issue["group_id"] for issue in top_5_issues]
        is_handled = [issue["is_handled"] for issue in top_5_issues]

        # filters handled issues
        assert top_5_issue_ids == [self.group_id, group_id_1, group_id_3]
        assert is_handled == [0, 0, 0]

    def test_get_issue_table_contents(self):
        group_id_1 = [
            self._create_event(
                culprit="issue1", filenames=["bar.py", "baz.py"], user_id=str(i), handled=False
            )
            for i in range(5)
        ][0].group.id
        group_id_2 = [
            self._create_event(
                culprit="issue2", filenames=["hello.py", "baz.py"], user_id=str(i), handled=False
            )
            for i in range(4)
        ][0].group.id
        group_id_3 = [
            self._create_event(
                culprit="issue3", filenames=["base.py", "baz.py"], user_id=str(i), handled=False
            )
            for i in range(3)
        ][0].group.id
        group_id_4 = [
            self._create_event(
                culprit="issue4", filenames=["nom.py", "baz.py"], user_id=str(i), handled=False
            )
            for i in range(2)
        ][0].group.id

        top_5_issues = get_top_5_issues_by_count_for_file([self.project], ["baz.py"])
        affected_users = [6, 5, 4, 3, 2]
        event_count = [issue["event_count"] for issue in top_5_issues]
        is_handled = [bool(issue["is_handled"]) for issue in top_5_issues]

        comment_table_contents = get_issue_table_contents(top_5_issues)
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
                    is_handled=is_handled[i],
                )
                in comment_table_contents
            )


@region_silo_test
class TestFormatComment(TestCase):
    def setUp(self):
        super().setUp()

    def test_comment_format(self):
        file1 = "tests/sentry/tasks/integrations/github/test_open_pr_comment.py"
        file1_issues = [
            PullRequestIssue(
                title="file1 " + str(i),
                subtitle="subtitle" + str(i),
                url=f"http://testserver/organizations/{self.organization.slug}/issues/{str(i)}/",
                affected_users=(5 - i) * 1000,
                event_count=(5 - i) * 1000,
                is_handled=True,
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
                is_handled=False,
            )
            for i in range(2)
        ]

        issue_table = format_issue_table(file1, file1_issues)
        toggle_issue_table = format_issue_table(file2, file2_issues, toggle=True)
        comment = format_open_pr_comment([issue_table, toggle_issue_table])

        assert (
            comment
            == """## 🔍 Existing Sentry Issues - For Review
Your pull request files have the following pre-existing issues:

📄 **tests/sentry/tasks/integrations/github/test_open_pr_comment.py**

| Issue  |
| :--------- |
| [**file1 0**](http://testserver/organizations/baz/issues/0/?referrer=github-open-pr-bot) subtitle0 <br> `Handled:` **True** `Event Count:` **5k** `Users:` **5k** |
| [**file1 1**](http://testserver/organizations/baz/issues/1/?referrer=github-open-pr-bot) subtitle1 <br> `Handled:` **True** `Event Count:` **4k** `Users:` **4k** |
| [**file1 2**](http://testserver/organizations/baz/issues/2/?referrer=github-open-pr-bot) subtitle2 <br> `Handled:` **True** `Event Count:` **3k** `Users:` **3k** |
| [**file1 3**](http://testserver/organizations/baz/issues/3/?referrer=github-open-pr-bot) subtitle3 <br> `Handled:` **True** `Event Count:` **2k** `Users:` **2k** |
| [**file1 4**](http://testserver/organizations/baz/issues/4/?referrer=github-open-pr-bot) subtitle4 <br> `Handled:` **True** `Event Count:` **1k** `Users:` **1k** |
<details>
<summary><b>📄 tests/sentry/tasks/integrations/github/test_pr_comment.py (Click to Expand)</b></summary>

| Issue  |
| :--------- |
| [**SoftTimeLimitExceeded 0**](http://testserver/organizations/baz/issues/5/?referrer=github-open-pr-bot) sentry.tasks.low_priority... <br> `Handled:` **False** `Event Count:` **20k** `Users:` **20k** |
| [**SoftTimeLimitExceeded 1**](http://testserver/organizations/baz/issues/6/?referrer=github-open-pr-bot) sentry.tasks.low_priority... <br> `Handled:` **False** `Event Count:` **10k** `Users:` **10k** |
</details>
---

<sub>Did you find this useful? React with a 👍 or 👎 or let us know in #proj-github-pr-comments</sub>"""
        )


class TestOpenPRCommentWorkflow(IntegrationTestCase, CreateEventTestCase):
    base_url = "https://api.github.com"

    def setUp(self):
        self.user_id = "user_1"
        self.app_id = "app_1"

        self.group_id_1 = [self._create_event(culprit="issue1", user_id=str(i)) for i in range(5)][
            0
        ].group.id
        self.group_id_2 = [
            self._create_event(culprit="issue2", filenames=["foo.py", "bar.py"], user_id=str(i))
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
                "is_handled": False,
            }
            for i, g in enumerate(Group.objects.all())
        ]
        self.groups.reverse()

    @patch("sentry.tasks.integrations.github.open_pr_comment.get_pr_filenames")
    @patch(
        "sentry.tasks.integrations.github.open_pr_comment.get_projects_and_filenames_from_source_file"
    )
    @patch("sentry.tasks.integrations.github.open_pr_comment.get_top_5_issues_by_count_for_file")
    @patch(
        "sentry.tasks.integrations.github.open_pr_comment.safe_for_comment", return_value=(True, [])
    )
    @patch("sentry.tasks.integrations.github.pr_comment.metrics")
    @responses.activate
    def test_comment_workflow(
        self,
        mock_metrics,
        mock_safe_for_comment,
        mock_issues,
        mock_reverse_codemappings,
        mock_pr_filenames,
    ):
        # two filenames, the second one has a toggle table
        mock_pr_filenames.return_value = ["foo.py", "bar.py"]
        mock_reverse_codemappings.return_value = ([self.project], ["foo.py"])

        mock_issues.return_value = self.groups

        responses.add(
            responses.POST,
            self.base_url + "/repos/getsentry/sentry/issues/1/comments",
            json={"id": 1},
            headers={"X-Ratelimit-Limit": "60", "X-Ratelimit-Remaining": "59"},
        )

        open_pr_comment_workflow(self.pr.id)

        assert (
            responses.calls[0].request.body
            == f'{{"body": "## \\ud83d\\udd0d Existing Sentry Issues - For Review\\nYour pull request files have the following pre-existing issues:\\n\\n\\ud83d\\udcc4 **foo.py**\\n\\n| Issue  |\\n| :--------- |\\n| [**Error**](http://testserver/organizations/baz/issues/{self.group_id_2}/?referrer=github-open-pr-bot) issue2 <br> `Handled:` **False** `Event Count:` **2k** `Users:` **6** |\\n| [**Error**](http://testserver/organizations/baz/issues/{self.group_id_1}/?referrer=github-open-pr-bot) issue1 <br> `Handled:` **False** `Event Count:` **1k** `Users:` **5** |\\n<details>\\n<summary><b>\\ud83d\\udcc4 bar.py (Click to Expand)</b></summary>\\n\\n| Issue  |\\n| :--------- |\\n| [**Error**](http://testserver/organizations/baz/issues/{self.group_id_2}/?referrer=github-open-pr-bot) issue2 <br> `Handled:` **False** `Event Count:` **2k** `Users:` **6** |\\n| [**Error**](http://testserver/organizations/baz/issues/{self.group_id_1}/?referrer=github-open-pr-bot) issue1 <br> `Handled:` **False** `Event Count:` **1k** `Users:` **5** |\\n</details>\\n---\\n\\n<sub>Did you find this useful? React with a \\ud83d\\udc4d or \\ud83d\\udc4e or let us know in #proj-github-pr-comments</sub>"}}'.encode()
        )

        pull_request_comment_query = PullRequestComment.objects.all()
        assert len(pull_request_comment_query) == 1
        assert pull_request_comment_query[0].external_id == 1
        assert pull_request_comment_query[0].comment_type == CommentType.OPEN_PR
        mock_metrics.incr.assert_called_with("github_open_pr_comment.comment_created")

    @patch("sentry.tasks.integrations.github.open_pr_comment.get_pr_filenames")
    @patch(
        "sentry.tasks.integrations.github.open_pr_comment.get_projects_and_filenames_from_source_file"
    )
    @patch("sentry.tasks.integrations.github.open_pr_comment.get_top_5_issues_by_count_for_file")
    @patch(
        "sentry.tasks.integrations.github.open_pr_comment.safe_for_comment", return_value=(True, [])
    )
    @patch("sentry.tasks.integrations.github.pr_comment.metrics")
    @responses.activate
    def test_comment_workflow_comment_exists(
        self,
        mock_metrics,
        mock_safe_for_comment,
        mock_issues,
        mock_reverse_codemappings,
        mock_pr_filenames,
    ):
        # two filenames, the second one has a toggle table
        mock_pr_filenames.return_value = ["foo.py", "bar.py"]
        mock_reverse_codemappings.return_value = ([self.project], ["foo.py"])

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
        mock_metrics.incr.assert_called_with("github_open_pr_comment.comment_updated")

    @patch("sentry.tasks.integrations.github.open_pr_comment.get_pr_filenames")
    @patch(
        "sentry.tasks.integrations.github.open_pr_comment.get_projects_and_filenames_from_source_file"
    )
    @patch("sentry.tasks.integrations.github.open_pr_comment.get_top_5_issues_by_count_for_file")
    @patch(
        "sentry.tasks.integrations.github.open_pr_comment.safe_for_comment", return_value=(True, [])
    )
    @patch("sentry.tasks.integrations.github.open_pr_comment.metrics")
    @responses.activate
    def test_comment_workflow_early_return(
        self,
        mock_metrics,
        mock_safe_for_comment,
        mock_issues,
        mock_reverse_codemappings,
        mock_pr_filenames,
    ):
        mock_pr_filenames.return_value = ["foo.py"]
        # no codemappings
        mock_reverse_codemappings.return_value = ([], [])
        mock_issues.return_value = []

        open_pr_comment_workflow(self.pr.id)

        pull_request_comment_query = PullRequestComment.objects.all()
        assert len(pull_request_comment_query) == 0
        mock_metrics.incr.assert_called_with("github_open_pr_comment.no_issues")

        # has codemappings but no issues
        mock_reverse_codemappings.return_value = ([self.project], ["foo.py"])

        open_pr_comment_workflow(self.pr.id)

        pull_request_comment_query = PullRequestComment.objects.all()
        assert len(pull_request_comment_query) == 0
        mock_metrics.incr.assert_called_with("github_open_pr_comment.no_issues")

    @patch("sentry.tasks.integrations.github.open_pr_comment.get_pr_filenames")
    @patch(
        "sentry.tasks.integrations.github.open_pr_comment.get_projects_and_filenames_from_source_file"
    )
    @patch("sentry.tasks.integrations.github.open_pr_comment.get_top_5_issues_by_count_for_file")
    @patch(
        "sentry.tasks.integrations.github.open_pr_comment.safe_for_comment", return_value=(True, [])
    )
    @patch("sentry.tasks.integrations.github.open_pr_comment.metrics")
    @responses.activate
    def test_comment_workflow_api_error(
        self,
        mock_metrics,
        mock_safe_for_comment,
        mock_issues,
        mock_reverse_codemappings,
        mock_pr_filenames,
    ):
        mock_pr_filenames.return_value = ["foo.py"]
        mock_reverse_codemappings.return_value = ([self.project], ["foo.py"])

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
            mock_metrics.incr.assert_called_with("github_open_pr_comment.api_error")

        pr_2 = PullRequest.objects.create(
            organization_id=self.organization.id,
            repository_id=self.gh_repo.id,
            key=str(2),
        )

        # does not raise ApiError for locked issue
        open_pr_comment_workflow(pr_2.id)
        mock_metrics.incr.assert_called_with(
            "github_open_pr_comment.error", tags={"type": "issue_locked_error"}
        )

        pr_3 = PullRequest.objects.create(
            organization_id=self.organization.id,
            repository_id=self.gh_repo.id,
            key=str(3),
        )

        # does not raise ApiError for rate limited error
        open_pr_comment_workflow(pr_3.id)
        mock_metrics.incr.assert_called_with(
            "github_open_pr_comment.error", tags={"type": "rate_limited_error"}
        )

    @patch("sentry.tasks.integrations.github.open_pr_comment.get_pr_filenames")
    @patch("sentry.tasks.integrations.github.open_pr_comment.metrics")
    def test_comment_workflow_missing_pr(self, mock_metrics, mock_pr_filenames):
        PullRequest.objects.all().delete()

        open_pr_comment_workflow(0)

        assert not mock_pr_filenames.called
        mock_metrics.incr.assert_called_with(
            "github_open_pr_comment.error", tags={"type": "missing_pr"}
        )

    @patch("sentry.tasks.integrations.github.open_pr_comment.get_pr_filenames")
    @patch("sentry.tasks.integrations.github.open_pr_comment.metrics")
    def test_comment_workflow_missing_org(self, mock_metrics, mock_pr_filenames):
        self.pr.organization_id = 0
        self.pr.save()

        open_pr_comment_workflow(self.pr.id)

        assert not mock_pr_filenames.called
        mock_metrics.incr.assert_called_with(
            "github_open_pr_comment.error", tags={"type": "missing_org"}
        )

    @patch("sentry.tasks.integrations.github.open_pr_comment.get_pr_filenames")
    def test_comment_workflow_missing_org_option(self, mock_pr_filenames):
        OrganizationOption.objects.set_value(
            organization=self.organization, key="sentry:github_open_pr_bot", value=False
        )
        open_pr_comment_workflow(self.pr.id)

        assert not mock_pr_filenames.called

    @patch("sentry.tasks.integrations.github.open_pr_comment.get_pr_filenames")
    @patch("sentry.tasks.integrations.github.open_pr_comment.metrics")
    def test_comment_workflow_missing_repo(self, mock_metrics, mock_pr_filenames):
        self.pr.repository_id = 0
        self.pr.save()

        open_pr_comment_workflow(self.pr.id)

        assert not mock_pr_filenames.called
        mock_metrics.incr.assert_called_with(
            "github_open_pr_comment.error", tags={"type": "missing_repo"}
        )

    @patch("sentry.tasks.integrations.github.open_pr_comment.get_pr_filenames")
    @patch("sentry.tasks.integrations.github.open_pr_comment.metrics")
    def test_comment_workflow_missing_integration(self, mock_metrics, mock_pr_filenames):
        # invalid integration id
        self.gh_repo.integration_id = 0
        self.gh_repo.save()

        open_pr_comment_workflow(self.pr.id)

        assert not mock_pr_filenames.called
        mock_metrics.incr.assert_called_with(
            "github_open_pr_comment.error", tags={"type": "missing_integration"}
        )

    @patch(
        "sentry.tasks.integrations.github.open_pr_comment.safe_for_comment",
        return_value=(False, []),
    )
    @patch("sentry.tasks.integrations.github.open_pr_comment.get_pr_filenames")
    @patch("sentry.tasks.integrations.github.open_pr_comment.metrics")
    def test_comment_workflow_not_safe_for_comment(
        self, mock_metrics, mock_pr_filenames, mock_safe_for_comment
    ):
        open_pr_comment_workflow(self.pr.id)

        assert not mock_pr_filenames.called
        mock_metrics.incr.assert_called_with(
            "github_open_pr_comment.error", tags={"type": "unsafe_for_comment"}
        )
