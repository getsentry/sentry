from unittest.mock import patch

import responses

from sentry.tasks.integrations.github.open_pr_comment import get_pr_filenames, safe_for_comment
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
    def test_simple(self):
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
