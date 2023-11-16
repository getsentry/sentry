from unittest.mock import patch

import responses

from sentry.tasks.integrations.github.open_pr_comment import (
    get_pr_filenames,
    get_projects_and_filenames_from_source_file,
    get_top_5_issues_by_count_for_file,
    safe_for_comment,
)
from sentry.testutils.helpers.datetime import before_now, iso_format
from sentry.testutils.silo import region_silo_test
from sentry.testutils.skips import requires_snuba
from tests.sentry.tasks.integrations.github.test_pr_comment import GithubCommentTestCase

pytestmark = [requires_snuba]


@region_silo_test(stable=True)
class TestSafeForComment(GithubCommentTestCase):
    def setUp(self):
        super().setUp()
        self.pr = self.create_pr_issues()
        self.mock_metrics = patch(
            "sentry.tasks.integrations.github.open_pr_comment.metrics"
        ).start()
        self.gh_path = self.base_url + "/repos/getsentry/sentry/pulls/{pull_number}"
        installation = self.integration.get_installation(organization_id=self.organization.id)
        self.gh_client = installation.get_client()

    @responses.activate
    def test_simple(self):
        responses.add(
            responses.GET,
            self.gh_path.format(pull_number=self.pr.key),
            status=200,
            json={"changed_files": 5, "additions": 100, "deletions": 100, "state": "open"},
        )

        assert safe_for_comment(self.gh_client, self.gh_repo, self.pr)

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

        assert not safe_for_comment(self.gh_client, self.gh_repo, self.pr)
        self.mock_metrics.incr.assert_called_with(
            "github_open_pr_comment.api_error", tags={"type": "gh_rate_limited", "code": 429}
        )

    @responses.activate
    def test_error__missing_pr(self):
        responses.add(
            responses.GET, self.gh_path.format(pull_number=self.pr.key), status=404, json={}
        )

        assert not safe_for_comment(self.gh_client, self.gh_repo, self.pr)
        self.mock_metrics.incr.assert_called_with(
            "github_open_pr_comment.api_error",
            tags={"type": "missing_gh_pull_request", "code": 404},
        )

    @responses.activate
    def test_error__api_error(self):
        responses.add(
            responses.GET, self.gh_path.format(pull_number=self.pr.key), status=400, json={}
        )

        assert not safe_for_comment(self.gh_client, self.gh_repo, self.pr)
        self.mock_metrics.incr.assert_called_with(
            "github_open_pr_comment.api_error", tags={"type": "unknown_api_error", "code": 400}
        )

    @responses.activate
    def test_not_open_pr(self):
        responses.add(
            responses.GET,
            self.gh_path.format(pull_number=self.pr.key),
            status=200,
            json={"changed_files": 5, "additions": 100, "deletions": 100, "state": "closed"},
        )

        assert not safe_for_comment(self.gh_client, self.gh_repo, self.pr)
        self.mock_metrics.incr.assert_called_with(
            "github_open_pr_comment.rejected_comment", tags={"reason": "incorrect_state"}
        )

    @responses.activate
    def test_too_many_files(self):
        responses.add(
            responses.GET,
            self.gh_path.format(pull_number=self.pr.key),
            status=200,
            json={"changed_files": 11, "additions": 100, "deletions": 100, "state": "open"},
        )

        assert not safe_for_comment(self.gh_client, self.gh_repo, self.pr)
        self.mock_metrics.incr.assert_called_with(
            "github_open_pr_comment.rejected_comment", tags={"reason": "too_many_files"}
        )

    @responses.activate
    def test_too_many_lines(self):
        responses.add(
            responses.GET,
            self.gh_path.format(pull_number=self.pr.key),
            status=200,
            json={"changed_files": 5, "additions": 300, "deletions": 300, "state": "open"},
        )

        assert not safe_for_comment(self.gh_client, self.gh_repo, self.pr)
        self.mock_metrics.incr.assert_called_with(
            "github_open_pr_comment.rejected_comment", tags={"reason": "too_many_lines"}
        )

    @responses.activate
    def test_too_many_files_and_lines(self):
        responses.add(
            responses.GET,
            self.gh_path.format(pull_number=self.pr.key),
            status=200,
            json={"changed_files": 11, "additions": 300, "deletions": 300, "state": "open"},
        )

        assert not safe_for_comment(self.gh_client, self.gh_repo, self.pr)
        self.mock_metrics.incr.assert_any_call(
            "github_open_pr_comment.rejected_comment", tags={"reason": "too_many_lines"}
        )
        self.mock_metrics.incr.assert_any_call(
            "github_open_pr_comment.rejected_comment", tags={"reason": "too_many_files"}
        )


@region_silo_test(stable=True)
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
        responses.add(
            responses.GET,
            self.gh_path.format(pull_number=self.pr.key),
            status=200,
            json=[
                {"filename": "foo.py", "status": "added"},
                {"filename": "bar.py", "status": "modified"},
                {"filename": "baz.py", "status": "deleted"},
            ],
        )

        assert set(get_pr_filenames(self.gh_client, self.gh_repo, self.pr)) == {"bar.py", "baz.py"}

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
            filename.replace(source_root, stack_root)
            for source_root, stack_root in source_stack_pairs
        ]

        project_list, sentry_filenames = get_projects_and_filenames_from_source_file(
            self.organization.id, filename
        )
        assert project_list == set(projects)
        assert sentry_filenames == set(correct_filenames)


@region_silo_test(stable=True)
class TestGetIssues(GithubCommentTestCase):
    def setUp(self):
        super().setUp()

        self.group_id = [self._create_event() for _ in range(6)][0].group.id

    def _create_event(self, filenames=None, project_id=None, timestamp=None):
        if timestamp is None:
            timestamp = iso_format(before_now(seconds=5))
        if filenames is None:
            filenames = ["foo.py", "baz.py"]
        if project_id is None:
            project_id = self.project.id

        return self.store_event(
            data={
                "message": "hello!",
                "platform": "python",
                "timestamp": timestamp,
                "exception": {
                    "values": [
                        {
                            "type": "Error",
                            "stacktrace": {
                                "frames": [{"filename": filename} for filename in filenames],
                            },
                        }
                    ]
                },
            },
            project_id=project_id,
            assert_no_errors=False,
        )

    def test_simple(self):
        top_5_issues = get_top_5_issues_by_count_for_file([self.project], ["baz.py"])
        top_5_issue_ids = [issue["group_id"] for issue in top_5_issues]
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
            timestamp=iso_format(before_now(days=30)), filenames=["bar.py", "baz.py"]
        ).group.id

        top_5_issues = get_top_5_issues_by_count_for_file([self.project], ["baz.py"])
        top_5_issue_ids = [issue["group_id"] for issue in top_5_issues]
        assert group_id != self.group_id
        assert top_5_issue_ids == [self.group_id]

    def test_fetches_top_five_issues(self):
        group_id_1 = [self._create_event(filenames=["bar.py", "baz.py"]) for _ in range(5)][
            0
        ].group.id
        group_id_2 = [self._create_event(filenames=["hello.py", "baz.py"]) for _ in range(4)][
            0
        ].group.id
        group_id_3 = [self._create_event(filenames=["base.py", "baz.py"]) for _ in range(3)][
            0
        ].group.id
        group_id_4 = [self._create_event(filenames=["nom.py", "baz.py"]) for _ in range(2)][
            0
        ].group.id
        # 6th issue
        self._create_event(filenames=["nan.py", "baz.py"])
        # unrelated issue with same stack trace in different project
        self._create_event(project_id=self.another_org_project.id)

        top_5_issues = get_top_5_issues_by_count_for_file([self.project], ["baz.py"])
        top_5_issue_ids = [issue["group_id"] for issue in top_5_issues]
        assert top_5_issue_ids == [self.group_id, group_id_1, group_id_2, group_id_3, group_id_4]
