from typing import Any
from unittest.mock import MagicMock, patch

from sentry.scm.types import PullRequestReviewEvent, SubscriptionEvent
from sentry.seer.agent.client_models import RepoPRState, SeerRunState
from sentry.seer.autofix.constants import AutofixReferrer
from sentry.seer.autofix.pr_iteration.feedback_sources.github_comment import (
    GithubPrReviewBodyFeedbackSource,
    GithubPrReviewCommentFeedbackSource,
)
from sentry.seer.autofix.pr_iteration.review import (
    handle_pull_request_review_for_autofix_iteration,
)
from sentry.tasks.seer.pr_iteration import _REVIEW_PAGE_SIZE, trigger_pr_iteration_from_review
from sentry.testutils.cases import TestCase

REVIEW_PATH = "sentry.seer.autofix.pr_iteration.review"
TASK_PATH = "sentry.tasks.seer.pr_iteration"


class HandlePullRequestReviewForAutofixIterationTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.repo = self.create_repo(
            project=self.project,
            provider="integrations:github",
            external_id="7654321",
            name="owner/repo",
        )

    def _event(
        self,
        *,
        action: str = "submitted",
        state: str = "commented",
        author_id: str = "999",
        is_bot: bool = False,
        installation_id: int | None = 12345,
        repository_id: int | None = 7654321,
        pull_request_id: str = "7",
        review_id: str = "500",
        provider: str = "github",
    ) -> PullRequestReviewEvent:
        subscription: SubscriptionEvent = {
            "received_at": 0,
            "type": provider,  # type: ignore[typeddict-item]
            "event_type_hint": "pull_request_review",
            "event": "{}",
            "extra": {
                "installation_id": installation_id,
                "repository_id": repository_id,
            },
            "sentry_meta": None,
        }
        return PullRequestReviewEvent(
            action=action,  # type: ignore[arg-type]
            pull_request_review={
                "id": review_id,
                "state": state,  # type: ignore[typeddict-item]
                "pull_request_id": pull_request_id,
            },
            author={"id": author_id, "username": "reviewer"},
            is_bot=is_bot,
            subscription_event=subscription,
        )

    def _mock_org_contexts(self, mock_contexts: MagicMock) -> None:
        install = MagicMock(organization_id=self.organization.id)
        mock_contexts.return_value = MagicMock(
            integration=MagicMock(id=42),
            organization_integrations=[install],
        )

    @patch(f"{TASK_PATH}.trigger_pr_iteration_from_review.delay")
    @patch(f"{REVIEW_PATH}.integration_service.organization_contexts")
    def test_dispatches_task_for_submitted_review(
        self, mock_contexts: MagicMock, mock_delay: MagicMock
    ) -> None:
        self._mock_org_contexts(mock_contexts)
        with self.feature("organizations:autofix-pr-iteration"):
            handle_pull_request_review_for_autofix_iteration(self._event())

        mock_delay.assert_called_once()
        kwargs = mock_delay.call_args.kwargs
        assert kwargs["organization_id"] == self.organization.id
        assert kwargs["repo_id"] == self.repo.id
        assert kwargs["integration_id"] == 42
        assert kwargs["pr_number"] == 7
        assert kwargs["review_id"] == 500

    @patch(f"{TASK_PATH}.trigger_pr_iteration_from_review.delay")
    @patch(f"{REVIEW_PATH}.integration_service.organization_contexts")
    def test_skips_non_submitted_action(
        self, mock_contexts: MagicMock, mock_delay: MagicMock
    ) -> None:
        self._mock_org_contexts(mock_contexts)
        with self.feature("organizations:autofix-pr-iteration"):
            handle_pull_request_review_for_autofix_iteration(self._event(action="edited"))
        mock_delay.assert_not_called()

    @patch(f"{TASK_PATH}.trigger_pr_iteration_from_review.delay")
    @patch(f"{REVIEW_PATH}.integration_service.organization_contexts")
    def test_bot_review_is_acted_on(self, mock_contexts: MagicMock, mock_delay: MagicMock) -> None:
        self._mock_org_contexts(mock_contexts)
        # Any submitted review triggers an iteration, including bot reviews — our
        # own app's code review and third-party AI review bots alike.
        with self.feature("organizations:autofix-pr-iteration"):
            handle_pull_request_review_for_autofix_iteration(
                self._event(author_id="333333", is_bot=True)
            )
        mock_delay.assert_called_once()

    @patch(f"{TASK_PATH}.trigger_pr_iteration_from_review.delay")
    @patch(f"{REVIEW_PATH}.integration_service.organization_contexts")
    def test_skips_when_feature_disabled(
        self, mock_contexts: MagicMock, mock_delay: MagicMock
    ) -> None:
        self._mock_org_contexts(mock_contexts)
        handle_pull_request_review_for_autofix_iteration(self._event())
        mock_delay.assert_not_called()

    @patch(f"{TASK_PATH}.trigger_pr_iteration_from_review.delay")
    @patch(f"{REVIEW_PATH}.integration_service.organization_contexts")
    def test_skips_when_no_integration(
        self, mock_contexts: MagicMock, mock_delay: MagicMock
    ) -> None:
        mock_contexts.return_value = MagicMock(integration=None, organization_integrations=[])
        with self.feature("organizations:autofix-pr-iteration"):
            handle_pull_request_review_for_autofix_iteration(self._event())
        mock_delay.assert_not_called()

    @patch(f"{TASK_PATH}.trigger_pr_iteration_from_review.delay")
    @patch(f"{REVIEW_PATH}.integration_service.organization_contexts")
    def test_skips_when_missing_ids(self, mock_contexts: MagicMock, mock_delay: MagicMock) -> None:
        self._mock_org_contexts(mock_contexts)
        with self.feature("organizations:autofix-pr-iteration"):
            handle_pull_request_review_for_autofix_iteration(self._event(installation_id=None))
        mock_delay.assert_not_called()


class _ScmStub:
    """Spec for the SCM client mock so the ``runtime_checkable`` protocol
    ``isinstance`` guards in the task pass (a bare ``MagicMock`` fails them)."""

    def get_review_comments(self, *args: Any, **kwargs: Any) -> Any: ...

    def list_pull_request_reviews(self, *args: Any, **kwargs: Any) -> Any: ...

    def create_review_comment_reaction(self, *args: Any, **kwargs: Any) -> Any: ...


class TriggerPrIterationFromReviewTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.group = self.create_group(project=self.project)
        self.repo = self.create_repo(
            project=self.project,
            provider="integrations:github",
            external_id="123",
            name="owner/repo",
        )

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

    def _review_comment(
        self,
        *,
        comment_id: str,
        body: str,
        file_path: str = "src/sentry/foo.py",
        line: int | None = 42,
        start_line: int | None = 40,
    ) -> dict[str, Any]:
        # The SCM normalizes line positions to ``DiffLine`` dicts ({"head": N}),
        # not plain ints — mirror that so the flattening path is exercised.
        return {
            "id": comment_id,
            "unique_id": None,
            "url": f"https://github.com/owner/repo/pull/7#discussion_r{comment_id}",
            "file_path": file_path,
            "body": body,
            "author": {"id": "999", "username": "reviewer"},
            "line": {"head": line} if line is not None else None,
            "start_line": {"head": start_line} if start_line is not None else None,
            "review_id": "500",
        }

    def _paginated(self, data: list[Any]) -> dict[str, Any]:
        return {"data": data, "type": "github", "raw": {}, "meta": {"next_cursor": None}}

    def _run(self) -> None:
        trigger_pr_iteration_from_review(
            organization_id=self.organization.id,
            repo_id=self.repo.id,
            integration_id=42,
            pr_number=7,
            review_id=500,
        )

    @patch(f"{TASK_PATH}.scm_actions")
    @patch(f"{TASK_PATH}.make_scm")
    @patch(f"{TASK_PATH}.consume_queued_autofix_feedback.apply_async")
    @patch(f"{TASK_PATH}.try_enqueue_autofix_feedback")
    @patch(f"{TASK_PATH}.get_agent_state_from_pr_id")
    @patch(f"{TASK_PATH}.integration_service.get_integration")
    def test_batch_review_with_inline_comments_and_body(
        self,
        mock_get_integration: MagicMock,
        mock_get_state: MagicMock,
        mock_enqueue: MagicMock,
        mock_consume: MagicMock,
        mock_make_scm: MagicMock,
        mock_actions: MagicMock,
    ) -> None:
        mock_get_integration.return_value = self._mock_integration()
        mock_get_state.return_value = self._agent_state()
        mock_make_scm.return_value = MagicMock(spec=_ScmStub)
        mock_actions.get_review_comments.return_value = self._paginated(
            [
                self._review_comment(comment_id="1", body="fix this"),
                self._review_comment(comment_id="2", body="and this"),
            ]
        )
        mock_actions.list_pull_request_reviews.return_value = self._paginated(
            [{"id": "500", "html_url": "https://x/500", "body": "overall summary"}]
        )

        self._run()

        # PR number -> id lookup before run lookup.
        mock_get_integration.return_value.get_installation.return_value.get_client.return_value.get_pull_request.assert_called_once_with(
            "owner/repo", "7"
        )
        mock_get_state.assert_called_once_with(self.organization.id, "integrations:github", 555)

        # Two inline comments + one review body item.
        assert mock_enqueue.call_count == 3
        sources = [c.kwargs["feedback"].source for c in mock_enqueue.call_args_list]
        comment_sources = [s for s in sources if isinstance(s, GithubPrReviewCommentFeedbackSource)]
        body_sources = [s for s in sources if isinstance(s, GithubPrReviewBodyFeedbackSource)]
        assert len(comment_sources) == 2
        assert len(body_sources) == 1
        assert body_sources[0].body == "overall summary"
        # The SCM ``url`` maps onto the source's ``html_url``; the UI drops
        # comments without it, so this is what surfaces the feedback.
        assert {s.comment.html_url for s in comment_sources} == {
            "https://github.com/owner/repo/pull/7#discussion_r1",
            "https://github.com/owner/repo/pull/7#discussion_r2",
        }
        assert all(
            c.kwargs["referrer"] == AutofixReferrer.GITHUB_PR_REVIEW
            for c in mock_enqueue.call_args_list
        )
        mock_consume.assert_called_once()

        # Each inline comment is acked with :eyes: (the body has no reaction target).
        assert mock_actions.create_review_comment_reaction.call_count == 2
        reacted_ids = {
            c.args[2] for c in mock_actions.create_review_comment_reaction.call_args_list
        }
        assert reacted_ids == {"1", "2"}
        assert all(
            c.args[3] == "eyes" for c in mock_actions.create_review_comment_reaction.call_args_list
        )

    @patch(f"{TASK_PATH}.scm_actions")
    @patch(f"{TASK_PATH}.make_scm")
    @patch(f"{TASK_PATH}.consume_queued_autofix_feedback.apply_async")
    @patch(f"{TASK_PATH}.try_enqueue_autofix_feedback")
    @patch(f"{TASK_PATH}.get_agent_state_from_pr_id")
    @patch(f"{TASK_PATH}.integration_service.get_integration")
    def test_paginates_review_comments_and_reviews(
        self,
        mock_get_integration: MagicMock,
        mock_get_state: MagicMock,
        mock_enqueue: MagicMock,
        mock_consume: MagicMock,
        mock_make_scm: MagicMock,
        mock_actions: MagicMock,
    ) -> None:
        # A full first page (>= page size) must fetch a second page; every
        # paginated request must carry ``per_page`` (the GitHub provider reads it
        # unconditionally, so omitting it raises ``KeyError: 'per_page'``), and a
        # short second page terminates the loop.
        mock_get_integration.return_value = self._mock_integration()
        mock_get_state.return_value = self._agent_state()
        mock_make_scm.return_value = MagicMock(spec=_ScmStub)

        full_page = [
            self._review_comment(comment_id=str(i), body=f"comment {i}")
            for i in range(_REVIEW_PAGE_SIZE)
        ]
        last_page = [self._review_comment(comment_id=str(_REVIEW_PAGE_SIZE), body="last one")]
        mock_actions.get_review_comments.side_effect = [
            self._paginated(full_page),
            self._paginated(last_page),
        ]
        # Target review lands on the second page, forcing the reviews loop to page too.
        full_reviews = [
            {"id": str(i), "html_url": f"https://x/{i}"} for i in range(_REVIEW_PAGE_SIZE)
        ]
        target_review = [{"id": "500", "html_url": "https://x/500", "body": "on page two"}]
        mock_actions.list_pull_request_reviews.side_effect = [
            self._paginated(full_reviews),
            self._paginated(target_review),
        ]

        self._run()

        # Two pages fetched for each resource.
        assert mock_actions.get_review_comments.call_count == 2
        assert mock_actions.list_pull_request_reviews.call_count == 2
        # per_page present and page number advances on every call.
        for call in mock_actions.get_review_comments.call_args_list:
            pagination = call.args[3]
            assert pagination["per_page"] == _REVIEW_PAGE_SIZE
        comment_pages = [
            c.args[3]["cursor"] for c in mock_actions.get_review_comments.call_args_list
        ]
        assert comment_pages == ["1", "2"]

        # All inline comments across both pages, plus the paged-to review body.
        sources = [c.kwargs["feedback"].source for c in mock_enqueue.call_args_list]
        comment_sources = [s for s in sources if isinstance(s, GithubPrReviewCommentFeedbackSource)]
        body_sources = [s for s in sources if isinstance(s, GithubPrReviewBodyFeedbackSource)]
        assert len(comment_sources) == _REVIEW_PAGE_SIZE + 1
        assert len(body_sources) == 1
        assert body_sources[0].body == "on page two"
        mock_consume.assert_called_once()

    @patch(f"{TASK_PATH}.scm_actions")
    @patch(f"{TASK_PATH}.make_scm")
    @patch(f"{TASK_PATH}.consume_queued_autofix_feedback.apply_async")
    @patch(f"{TASK_PATH}.try_enqueue_autofix_feedback")
    @patch(f"{TASK_PATH}.get_agent_state_from_pr_id")
    @patch(f"{TASK_PATH}.integration_service.get_integration")
    def test_inline_comment_produces_file_line_anchor(
        self,
        mock_get_integration: MagicMock,
        mock_get_state: MagicMock,
        mock_enqueue: MagicMock,
        mock_consume: MagicMock,
        mock_make_scm: MagicMock,
        mock_actions: MagicMock,
    ) -> None:
        mock_get_integration.return_value = self._mock_integration()
        mock_get_state.return_value = self._agent_state()
        mock_make_scm.return_value = MagicMock(spec=_ScmStub)
        mock_actions.get_review_comments.return_value = self._paginated(
            [self._review_comment(comment_id="1", body="no @sentry command here")]
        )
        mock_actions.list_pull_request_reviews.return_value = self._paginated([])

        self._run()

        source = mock_enqueue.call_args.kwargs["feedback"].source
        assert isinstance(source, GithubPrReviewCommentFeedbackSource)
        # Field mapping recovers the anchor from the SCM ReviewComment.
        assert source.file_path == "src/sentry/foo.py"
        assert source.line == 42
        assert source.start_line == 40
        # No @sentry command required on the review path.
        assert source.comment.id == 1
        assert "Inline comment on src/sentry/foo.py:40-42:" in source.text
        assert "no @sentry command here" in source.text

    @patch(f"{TASK_PATH}.scm_actions")
    @patch(f"{TASK_PATH}.make_scm")
    @patch(f"{TASK_PATH}.consume_queued_autofix_feedback.apply_async")
    @patch(f"{TASK_PATH}.try_enqueue_autofix_feedback")
    @patch(f"{TASK_PATH}.get_agent_state_from_pr_id")
    @patch(f"{TASK_PATH}.integration_service.get_integration")
    def test_body_only_review(
        self,
        mock_get_integration: MagicMock,
        mock_get_state: MagicMock,
        mock_enqueue: MagicMock,
        mock_consume: MagicMock,
        mock_make_scm: MagicMock,
        mock_actions: MagicMock,
    ) -> None:
        mock_get_integration.return_value = self._mock_integration()
        mock_get_state.return_value = self._agent_state()
        mock_make_scm.return_value = MagicMock(spec=_ScmStub)
        mock_actions.get_review_comments.return_value = self._paginated([])
        mock_actions.list_pull_request_reviews.return_value = self._paginated(
            [{"id": "500", "html_url": "https://x/500", "body": "please rename this"}]
        )

        self._run()

        mock_enqueue.assert_called_once()
        source = mock_enqueue.call_args.kwargs["feedback"].source
        assert isinstance(source, GithubPrReviewBodyFeedbackSource)
        assert source.body == "please rename this"
        assert source.review_id == 500

        # A body-only review has no inline comment to react to.
        mock_actions.create_review_comment_reaction.assert_not_called()

    @patch(f"{TASK_PATH}.scm_actions")
    @patch(f"{TASK_PATH}.make_scm")
    @patch(f"{TASK_PATH}.consume_queued_autofix_feedback.apply_async")
    @patch(f"{TASK_PATH}.try_enqueue_autofix_feedback")
    @patch(f"{TASK_PATH}.get_agent_state_from_pr_id")
    @patch(f"{TASK_PATH}.integration_service.get_integration")
    def test_single_comment_review(
        self,
        mock_get_integration: MagicMock,
        mock_get_state: MagicMock,
        mock_enqueue: MagicMock,
        mock_consume: MagicMock,
        mock_make_scm: MagicMock,
        mock_actions: MagicMock,
    ) -> None:
        mock_get_integration.return_value = self._mock_integration()
        mock_get_state.return_value = self._agent_state()
        mock_make_scm.return_value = MagicMock(spec=_ScmStub)
        # GitHub's "Add single comment" fires a review with state=commented, one
        # inline comment and no body.
        mock_actions.get_review_comments.return_value = self._paginated(
            [self._review_comment(comment_id="1", body="typo")]
        )
        mock_actions.list_pull_request_reviews.return_value = self._paginated(
            [{"id": "500", "html_url": "https://x/500", "body": ""}]
        )

        self._run()

        mock_enqueue.assert_called_once()
        source = mock_enqueue.call_args.kwargs["feedback"].source
        assert isinstance(source, GithubPrReviewCommentFeedbackSource)

        # The single inline comment is acked with :eyes:.
        mock_actions.create_review_comment_reaction.assert_called_once()
        assert mock_actions.create_review_comment_reaction.call_args.args[2] == "1"
        assert mock_actions.create_review_comment_reaction.call_args.args[3] == "eyes"

    @patch(f"{TASK_PATH}.scm_actions")
    @patch(f"{TASK_PATH}.make_scm")
    @patch(f"{TASK_PATH}.consume_queued_autofix_feedback.apply_async")
    @patch(f"{TASK_PATH}.try_enqueue_autofix_feedback")
    @patch(f"{TASK_PATH}.get_agent_state_from_pr_id")
    @patch(f"{TASK_PATH}.integration_service.get_integration")
    def test_empty_review_is_skipped(
        self,
        mock_get_integration: MagicMock,
        mock_get_state: MagicMock,
        mock_enqueue: MagicMock,
        mock_consume: MagicMock,
        mock_make_scm: MagicMock,
        mock_actions: MagicMock,
    ) -> None:
        mock_get_integration.return_value = self._mock_integration()
        mock_get_state.return_value = self._agent_state()
        mock_make_scm.return_value = MagicMock(spec=_ScmStub)
        # A bare approve: no body text AND no inline comments.
        mock_actions.get_review_comments.return_value = self._paginated([])
        mock_actions.list_pull_request_reviews.return_value = self._paginated(
            [{"id": "500", "html_url": "https://x/500", "body": ""}]
        )

        self._run()

        mock_enqueue.assert_not_called()
        mock_consume.assert_not_called()

    @patch(f"{TASK_PATH}.scm_actions")
    @patch(f"{TASK_PATH}.make_scm")
    @patch(f"{TASK_PATH}.consume_queued_autofix_feedback.apply_async")
    @patch(f"{TASK_PATH}.try_enqueue_autofix_feedback")
    @patch(f"{TASK_PATH}.get_agent_state_from_pr_id")
    @patch(f"{TASK_PATH}.integration_service.get_integration")
    def test_looks_good_review_is_not_skipped(
        self,
        mock_get_integration: MagicMock,
        mock_get_state: MagicMock,
        mock_enqueue: MagicMock,
        mock_consume: MagicMock,
        mock_make_scm: MagicMock,
        mock_actions: MagicMock,
    ) -> None:
        mock_get_integration.return_value = self._mock_integration()
        mock_get_state.return_value = self._agent_state()
        mock_make_scm.return_value = MagicMock(spec=_ScmStub)
        # "looks good" has content, so it is passed through to the agent.
        mock_actions.get_review_comments.return_value = self._paginated([])
        mock_actions.list_pull_request_reviews.return_value = self._paginated(
            [{"id": "500", "html_url": "https://x/500", "body": "looks good"}]
        )

        self._run()

        mock_enqueue.assert_called_once()
        source = mock_enqueue.call_args.kwargs["feedback"].source
        assert isinstance(source, GithubPrReviewBodyFeedbackSource)
        assert source.body == "looks good"

    @patch(f"{TASK_PATH}.scm_actions")
    @patch(f"{TASK_PATH}.make_scm")
    @patch(f"{TASK_PATH}.consume_queued_autofix_feedback.apply_async")
    @patch(f"{TASK_PATH}.try_enqueue_autofix_feedback")
    @patch(f"{TASK_PATH}.get_agent_state_from_pr_id")
    @patch(f"{TASK_PATH}.integration_service.get_integration")
    def test_skips_when_no_agent_state(
        self,
        mock_get_integration: MagicMock,
        mock_get_state: MagicMock,
        mock_enqueue: MagicMock,
        mock_consume: MagicMock,
        mock_make_scm: MagicMock,
        mock_actions: MagicMock,
    ) -> None:
        mock_get_integration.return_value = self._mock_integration()
        mock_get_state.return_value = None

        self._run()

        mock_make_scm.assert_not_called()
        mock_enqueue.assert_not_called()
        mock_consume.assert_not_called()
