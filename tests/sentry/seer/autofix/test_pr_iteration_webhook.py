from unittest.mock import MagicMock, patch

from scm.types import (
    CreatePullRequestCommentReactionProtocol,
    CreateReviewCommentReactionProtocol,
)

from sentry.seer.agent.client_models import RepoPRState, SeerRunState
from sentry.seer.autofix.constants import AutofixReferrer
from sentry.seer.autofix.pr_iteration.mention import (
    handle_issue_comment_for_autofix_iteration,
    handle_pull_request_review_comment_for_autofix_iteration,
)
from sentry.seer.autofix.pr_iteration.types import (
    GithubPrCommentFeedbackType,
    GithubPrReviewCommentFeedbackSource,
)
from sentry.tasks.seer.pr_iteration import (
    _add_comment_eyes_reaction,
    _swap_comment_reaction_to_done,
    trigger_pr_iteration_from_comment,
)
from sentry.testutils.cases import TestCase

MENTION_PATH = "sentry.seer.autofix.pr_iteration.mention"
TASK_PATH = "sentry.tasks.seer.pr_iteration"


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
            feedback="fix it",
            comment={
                "id": 999,
                "body": "@sentry fix it",
                "user": {"login": "octocat"},
                "html_url": "https://github.com/getsentry/sentry/pull/7#issuecomment-999",
            },
            source_type="github-pr-comment",
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


class HandlePullRequestReviewCommentForAutofixIterationTest(TestCase):
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
                "html_url": "https://github.com/getsentry/sentry/pull/7#discussion_r999",
                "path": "src/sentry/foo.py",
                "line": 42,
                "start_line": 40,
            },
            "pull_request": {"number": 7},
        }

    def _call(self, event: dict):
        return handle_pull_request_review_comment_for_autofix_iteration(
            event=event,
            organization=self.organization,
            repo=self.repo,
            integration=self.integration,
        )

    @patch(f"{MENTION_PATH}.trigger_pr_iteration_from_comment.delay")
    def test_schedules_task_with_review_comment_source(self, mock_delay: MagicMock) -> None:
        with self.feature("organizations:autofix-pr-iteration"):
            self._call(self._event())

        mock_delay.assert_called_once()
        kwargs = mock_delay.call_args.kwargs
        assert kwargs["pr_number"] == 7
        assert kwargs["feedback"] == "fix it"
        assert kwargs["source_type"] == "github-pr-review-comment"

    @patch(f"{MENTION_PATH}.trigger_pr_iteration_from_comment.delay")
    def test_skips_non_created_action(self, mock_delay: MagicMock) -> None:
        with self.feature("organizations:autofix-pr-iteration"):
            self._call(self._event(action="edited"))
        mock_delay.assert_not_called()

    @patch(f"{MENTION_PATH}.trigger_pr_iteration_from_comment.delay")
    def test_skips_when_not_iterate_command(self, mock_delay: MagicMock) -> None:
        with self.feature("organizations:autofix-pr-iteration"):
            self._call(self._event(body="just a comment"))
        mock_delay.assert_not_called()


class TriggerPrIterationFromCommentTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.group = self.create_group(project=self.project)
        self.repo = self.create_repo(
            project=self.project,
            provider="integrations:github",
            external_id="123",
            name="owner/repo",
        )
        self.comment = {"id": 999, "body": "@sentry fix it", "user": {"login": "octocat"}}

    def _agent_state(self) -> SeerRunState:
        return SeerRunState(
            run_id=67890,
            blocks=[],
            status="completed",
            updated_at="2024-01-01T00:00:00Z",
            repo_pr_states={
                "owner/repo": RepoPRState(
                    repo_name="owner/repo", pr_url="https://example.com/pull/7"
                )
            },
            metadata={"group_id": self.group.id},
        )

    def _mock_integration(self, pr_id: int | None = 555) -> MagicMock:
        mock_client = MagicMock()
        mock_client.get_pull_request.return_value = {"id": pr_id}
        mock_integration = MagicMock()
        mock_integration.get_installation.return_value.get_client.return_value = mock_client
        return mock_integration

    def _call(
        self,
        comment: dict | None = None,
        source_type: GithubPrCommentFeedbackType = "github-pr-comment",
    ) -> None:
        trigger_pr_iteration_from_comment(
            organization_id=self.organization.id,
            repo_id=self.repo.id,
            integration_id=42,
            pr_number=7,
            feedback="fix it",
            comment=self.comment if comment is None else comment,
            source_type=source_type,
        )

    @patch(f"{TASK_PATH}._add_comment_eyes_reaction")
    @patch(f"{TASK_PATH}.make_scm")
    @patch(f"{TASK_PATH}._github_commenter_has_repo_write_access", return_value=True)
    @patch(f"{TASK_PATH}.consume_queued_autofix_feedback.apply_async")
    @patch(f"{TASK_PATH}.enqueue_autofix_feedback")
    @patch(f"{TASK_PATH}.get_agent_state_from_pr_id")
    @patch(f"{TASK_PATH}.integration_service.get_integration")
    def test_triggers_agent_when_authorized(
        self,
        mock_get_integration: MagicMock,
        mock_get_state: MagicMock,
        mock_enqueue: MagicMock,
        mock_consume: MagicMock,
        mock_has_access: MagicMock,
        mock_make_scm: MagicMock,
        mock_reaction: MagicMock,
    ) -> None:
        mock_integration = self._mock_integration()
        mock_get_integration.return_value = mock_integration
        mock_get_state.return_value = self._agent_state()

        self._call()

        mock_has_access.assert_called_once_with(mock_make_scm.return_value, "octocat")
        mock_enqueue.assert_called_once()
        _, kwargs = mock_enqueue.call_args
        assert kwargs["run_id"] == 67890
        assert kwargs["organization_id"] == self.organization.id
        assert kwargs["group_id"] == self.group.id
        assert kwargs["referrer"] == AutofixReferrer.GITHUB_PR_COMMENT
        assert kwargs["feedback"].text == "fix it"
        mock_consume.assert_called_once_with(
            kwargs={
                "run_id": 67890,
                "organization_id": self.organization.id,
                "group_id": self.group.id,
            }
        )
        mock_reaction.assert_called_once_with(
            mock_make_scm.return_value,
            source_type="github-pr-comment",
            pr_number=7,
            comment_id=999,
        )

    @patch(f"{TASK_PATH}.make_scm")
    @patch(f"{TASK_PATH}._github_commenter_has_repo_write_access", return_value=False)
    @patch(f"{TASK_PATH}.consume_queued_autofix_feedback.apply_async")
    @patch(f"{TASK_PATH}.enqueue_autofix_feedback")
    @patch(f"{TASK_PATH}.get_agent_state_from_pr_id")
    @patch(f"{TASK_PATH}.integration_service.get_integration")
    def test_skips_when_no_write_access(
        self,
        mock_get_integration: MagicMock,
        mock_get_state: MagicMock,
        mock_enqueue: MagicMock,
        mock_consume: MagicMock,
        mock_has_access: MagicMock,
        mock_make_scm: MagicMock,
    ) -> None:
        mock_get_integration.return_value = self._mock_integration()
        mock_get_state.return_value = self._agent_state()

        self._call()

        mock_has_access.assert_called_once()
        mock_enqueue.assert_not_called()
        mock_consume.assert_not_called()

    @patch(f"{TASK_PATH}._github_commenter_has_repo_write_access")
    @patch(f"{TASK_PATH}.consume_queued_autofix_feedback.apply_async")
    @patch(f"{TASK_PATH}.enqueue_autofix_feedback")
    @patch(f"{TASK_PATH}.get_agent_state_from_pr_id")
    @patch(f"{TASK_PATH}.integration_service.get_integration")
    def test_skips_when_no_agent_state(
        self,
        mock_get_integration: MagicMock,
        mock_get_state: MagicMock,
        mock_enqueue: MagicMock,
        mock_consume: MagicMock,
        mock_has_access: MagicMock,
    ) -> None:
        mock_get_integration.return_value = self._mock_integration()
        mock_get_state.return_value = None

        self._call()

        mock_has_access.assert_not_called()
        mock_enqueue.assert_not_called()
        mock_consume.assert_not_called()

    @patch(f"{TASK_PATH}._add_comment_eyes_reaction")
    @patch(f"{TASK_PATH}.make_scm")
    @patch(f"{TASK_PATH}._github_commenter_has_repo_write_access", return_value=True)
    @patch(f"{TASK_PATH}.consume_queued_autofix_feedback.apply_async")
    @patch(f"{TASK_PATH}.enqueue_autofix_feedback")
    @patch(f"{TASK_PATH}.get_agent_state_from_pr_id")
    @patch(f"{TASK_PATH}.integration_service.get_integration")
    def test_review_comment_hoists_file_and_line(
        self,
        mock_get_integration: MagicMock,
        mock_get_state: MagicMock,
        mock_enqueue: MagicMock,
        mock_consume: MagicMock,
        mock_has_access: MagicMock,
        mock_make_scm: MagicMock,
        mock_reaction: MagicMock,
    ) -> None:
        mock_get_integration.return_value = self._mock_integration()
        mock_get_state.return_value = self._agent_state()

        self._call(
            comment={
                **self.comment,
                "path": "src/sentry/foo.py",
                "line": 42,
                "start_line": 40,
            },
            source_type="github-pr-review-comment",
        )

        source = mock_enqueue.call_args.kwargs["feedback"].source
        assert isinstance(source, GithubPrReviewCommentFeedbackSource)
        assert source.type == "github-pr-review-comment"
        assert source.file_path == "src/sentry/foo.py"
        assert source.line == 42
        assert source.start_line == 40
        mock_reaction.assert_called_once_with(
            mock_make_scm.return_value,
            source_type="github-pr-review-comment",
            pr_number=7,
            comment_id=999,
        )


class AddCommentEyesReactionTest(TestCase):
    @patch(f"{TASK_PATH}.scm_actions")
    def test_pr_comment_uses_pull_request_comment_reaction(self, mock_actions: MagicMock) -> None:
        scm = MagicMock(spec=CreatePullRequestCommentReactionProtocol)
        _add_comment_eyes_reaction(
            scm, source_type="github-pr-comment", pr_number=7, comment_id=999
        )

        mock_actions.create_pull_request_comment_reaction.assert_called_once_with(
            scm, "7", "999", "eyes"
        )
        mock_actions.create_review_comment_reaction.assert_not_called()

    @patch(f"{TASK_PATH}.scm_actions")
    def test_review_comment_uses_review_comment_reaction(self, mock_actions: MagicMock) -> None:
        scm = MagicMock(spec=CreateReviewCommentReactionProtocol)
        _add_comment_eyes_reaction(
            scm, source_type="github-pr-review-comment", pr_number=7, comment_id=999
        )

        mock_actions.create_review_comment_reaction.assert_called_once_with(scm, "7", "999", "eyes")
        mock_actions.create_pull_request_comment_reaction.assert_not_called()

    @patch(f"{TASK_PATH}.scm_actions")
    def test_noop_when_provider_unsupported(self, mock_actions: MagicMock) -> None:
        # A provider that doesn't implement the reaction protocol is skipped.
        _add_comment_eyes_reaction(
            MagicMock(spec=object), source_type="github-pr-comment", pr_number=7, comment_id=999
        )

        mock_actions.create_pull_request_comment_reaction.assert_not_called()
        mock_actions.create_review_comment_reaction.assert_not_called()

    @patch(f"{TASK_PATH}.scm_actions")
    def test_swallows_reaction_exception(self, mock_actions: MagicMock) -> None:
        mock_actions.create_pull_request_comment_reaction.side_effect = Exception("boom")

        # Should not raise.
        _add_comment_eyes_reaction(
            MagicMock(spec=CreatePullRequestCommentReactionProtocol),
            source_type="github-pr-comment",
            pr_number=7,
            comment_id=999,
        )


class _FakePrCommentScm:
    """A provider implementing every top-level PR-comment reaction protocol."""

    def create_pull_request_comment_reaction(self, *args: object, **kwargs: object) -> None: ...
    def get_pull_request_comment_reactions(self, *args: object, **kwargs: object) -> None: ...
    def delete_pull_request_comment_reaction(self, *args: object, **kwargs: object) -> None: ...
    def get_authenticated_actor(self, *args: object, **kwargs: object) -> None: ...


class _FakeReviewCommentScm:
    """A provider implementing every inline review-comment reaction protocol."""

    def create_review_comment_reaction(self, *args: object, **kwargs: object) -> None: ...
    def get_review_comment_reactions(self, *args: object, **kwargs: object) -> None: ...
    def delete_review_comment_reaction(self, *args: object, **kwargs: object) -> None: ...
    def get_authenticated_actor(self, *args: object, **kwargs: object) -> None: ...


class SwapCommentReactionToDoneTest(TestCase):
    """The reaction actions are dispatched through a module-level table that binds
    the real ``scm_actions`` functions, so these drive a spec'd scm whose methods
    are mocks and assert on those — exercising the real delegation end to end."""

    def _reactions(self) -> dict:
        # Only ``own-eyes`` is our own :eyes: (authored by the bot); the others
        # (another user's :eyes:, our :hooray:, an author-less rollup entry) must
        # be left untouched.
        return {
            "data": [
                {"id": "own-eyes", "content": "eyes", "author": {"id": "bot", "username": "seer"}},
                {"id": "other-eyes", "content": "eyes", "author": {"id": "human", "username": "x"}},
                {
                    "id": "own-hooray",
                    "content": "hooray",
                    "author": {"id": "bot", "username": "seer"},
                },
                {"id": "orphan-eyes", "content": "eyes", "author": None},
            ]
        }

    def test_pr_comment_adds_hooray_and_deletes_own_eyes(self) -> None:
        scm = MagicMock(spec=_FakePrCommentScm)
        scm.get_authenticated_actor.return_value = {"data": {"id": "bot"}}
        scm.get_pull_request_comment_reactions.return_value = self._reactions()

        _swap_comment_reaction_to_done(
            scm,
            source_type="github-pr-comment",
            pr_number=7,
            comment_id=999,
            delete_eyes=True,
        )

        scm.create_pull_request_comment_reaction.assert_called_once_with("7", "999", "hooray")
        # Only our own :eyes: is deleted, matched by authenticated actor id.
        scm.delete_pull_request_comment_reaction.assert_called_once_with("7", "999", "own-eyes")

    def test_review_comment_adds_hooray_and_deletes_own_eyes(self) -> None:
        scm = MagicMock(spec=_FakeReviewCommentScm)
        scm.get_authenticated_actor.return_value = {"data": {"id": "bot"}}
        scm.get_review_comment_reactions.return_value = self._reactions()

        _swap_comment_reaction_to_done(
            scm,
            source_type="github-pr-review-comment",
            pr_number=7,
            comment_id=999,
            delete_eyes=True,
        )

        scm.create_review_comment_reaction.assert_called_once_with("7", "999", "hooray")
        scm.delete_review_comment_reaction.assert_called_once_with("7", "999", "own-eyes")

    def test_delete_eyes_false_only_adds(self) -> None:
        scm = MagicMock(spec=_FakePrCommentScm)

        _swap_comment_reaction_to_done(
            scm,
            source_type="github-pr-comment",
            pr_number=7,
            comment_id=999,
            delete_eyes=False,
        )

        scm.create_pull_request_comment_reaction.assert_called_once_with("7", "999", "hooray")
        # The reaction reads/deletes the swap would otherwise do are skipped.
        scm.get_authenticated_actor.assert_not_called()
        scm.get_pull_request_comment_reactions.assert_not_called()
        scm.delete_pull_request_comment_reaction.assert_not_called()

    def test_noop_when_provider_unsupported(self) -> None:
        scm = MagicMock(spec=[])  # implements no reaction protocol

        # Should not raise and should touch nothing.
        _swap_comment_reaction_to_done(
            scm,
            source_type="github-pr-comment",
            pr_number=7,
            comment_id=999,
            delete_eyes=True,
        )

        assert scm.mock_calls == []

    def test_swallows_exception(self) -> None:
        scm = MagicMock(spec=_FakePrCommentScm)
        scm.create_pull_request_comment_reaction.side_effect = Exception("boom")

        # Should not raise.
        _swap_comment_reaction_to_done(
            scm,
            source_type="github-pr-comment",
            pr_number=7,
            comment_id=999,
            delete_eyes=True,
        )
