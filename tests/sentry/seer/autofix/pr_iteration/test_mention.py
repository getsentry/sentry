from unittest.mock import MagicMock, patch

from sentry.seer.autofix.pr_iteration.mention import handle_issue_comment_for_autofix_iteration
from sentry.testutils.cases import TestCase

MENTION_PATH = "sentry.seer.autofix.pr_iteration.mention"


class HandleIssueCommentForAutofixIterationTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.repo = self.create_repo(
            project=self.project,
            provider="integrations:github",
            external_id="123",
            name="owner/repo",
        )
        self.integration = MagicMock(id=42, provider="github")

    def _event(self, body: str = "@sentry fix it", action: str = "created") -> dict:
        return {
            "action": action,
            "comment": {
                "id": 999,
                "body": body,
                "user": {"login": "octocat"},
                "html_url": "https://github.com/getsentry/sentry/pull/7#issuecomment-999",
            },
            "issue": {"number": 7, "pull_request": {"url": "https://example.com/pulls/7"}},
        }

    def _call(self, event: dict):
        return handle_issue_comment_for_autofix_iteration(
            event=event,
            organization=self.organization,
            repo=self.repo,
            integration=self.integration,
        )

    @patch(f"{MENTION_PATH}.trigger_pr_iteration_from_comment.delay")
    def test_schedules_task_for_valid_command(self, mock_delay: MagicMock) -> None:
        with self.feature("organizations:autofix-pr-iteration"):
            self._call(self._event())

        mock_delay.assert_called_once_with(
            organization_id=self.organization.id,
            repo_id=self.repo.id,
            integration_id=self.integration.id,
            pr_number=7,
            comment={
                "id": 999,
                "body": "@sentry fix it",
                "user": {"login": "octocat"},
                "html_url": "https://github.com/getsentry/sentry/pull/7#issuecomment-999",
            },
        )

    @patch(f"{MENTION_PATH}.trigger_pr_iteration_from_comment.delay")
    def test_skips_non_created_action(self, mock_delay: MagicMock) -> None:
        with self.feature("organizations:autofix-pr-iteration"):
            self._call(self._event(action="edited"))
        mock_delay.assert_not_called()

    @patch(f"{MENTION_PATH}.trigger_pr_iteration_from_comment.delay")
    def test_skips_when_not_pr_comment(self, mock_delay: MagicMock) -> None:
        event = self._event()
        event["issue"].pop("pull_request")
        with self.feature("organizations:autofix-pr-iteration"):
            self._call(event)
        mock_delay.assert_not_called()

    @patch(f"{MENTION_PATH}.trigger_pr_iteration_from_comment.delay")
    def test_skips_when_not_iterate_command(self, mock_delay: MagicMock) -> None:
        with self.feature("organizations:autofix-pr-iteration"):
            self._call(self._event(body="just a comment"))
        mock_delay.assert_not_called()

    @patch(f"{MENTION_PATH}.trigger_pr_iteration_from_comment.delay")
    def test_skips_when_feature_disabled(self, mock_delay: MagicMock) -> None:
        self._call(self._event())
        mock_delay.assert_not_called()

    @patch(f"{MENTION_PATH}.trigger_pr_iteration_from_comment.delay")
    def test_skips_when_no_pr_number(self, mock_delay: MagicMock) -> None:
        event = self._event()
        event["issue"].pop("number")
        with self.feature("organizations:autofix-pr-iteration"):
            self._call(event)
        mock_delay.assert_not_called()
