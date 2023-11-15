from unittest.mock import patch

import responses

from sentry.tasks.integrations.github.open_pr_comment import (
    get_pr_filenames,
    get_projects_and_filenames_from_source_file,
    safe_for_comment,
)
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
