from typing import Any
from unittest.mock import ANY, MagicMock, patch

from scm.errors import ResourceNotFound

from sentry.models.pullrequest import PullRequest
from sentry.scm.types import PullRequestReviewEvent, SubscriptionEvent
from sentry.seer.agent.client_models import MemoryBlock, Message, RepoPRState, SeerRunState
from sentry.seer.autofix.constants import AutofixReferrer
from sentry.seer.autofix.pr_iteration.feedback import Feedback, serialize_feedback
from sentry.seer.autofix.pr_iteration.feedback_sources.github_comment import (
    GithubPrReviewBodyFeedbackSource,
    GithubPrReviewCommentFeedbackSource,
)
from sentry.seer.autofix.pr_iteration.listeners.review import (
    handle_pull_request_review_for_autofix_iteration,
)
from sentry.tasks.seer.pr_iteration import _REVIEW_PAGE_SIZE, trigger_pr_iteration_from_review
from sentry.testutils.cases import TestCase

REVIEW_PATH = "sentry.seer.autofix.pr_iteration.listeners.review"
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
        skipped_authentication: bool = False,
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
                "skipped-authentication": skipped_authentication,
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
        with self.feature("organizations:autofix-pr-iteration-manual"):
            handle_pull_request_review_for_autofix_iteration(self._event())

        mock_delay.assert_called_once()
        kwargs = mock_delay.call_args.kwargs
        assert kwargs["organization_id"] == self.organization.id
        assert kwargs["repo_id"] == self.repo.id
        assert kwargs["integration_id"] == 42
        assert kwargs["pr_number"] == 7
        assert kwargs["review_id"] == 500
        # Author is threaded to the task, which gates on its repo write access.
        assert kwargs["author_username"] == "reviewer"
        assert kwargs["author_external_id"] == "999"
        # Human authorship is threaded through so the task can apply the
        # automated-only streak cap.
        assert kwargs["author_is_bot"] is False

    @patch(f"{TASK_PATH}.trigger_pr_iteration_from_review.delay")
    @patch(f"{REVIEW_PATH}.integration_service.organization_contexts")
    def test_skips_non_submitted_action(
        self, mock_contexts: MagicMock, mock_delay: MagicMock
    ) -> None:
        self._mock_org_contexts(mock_contexts)
        with self.feature("organizations:autofix-pr-iteration-manual"):
            handle_pull_request_review_for_autofix_iteration(self._event(action="edited"))
        mock_delay.assert_not_called()

    @patch(f"{TASK_PATH}.trigger_pr_iteration_from_review.delay")
    @patch(f"{REVIEW_PATH}.integration_service.organization_contexts")
    def test_bot_review_is_dispatched_for_write_check(
        self, mock_contexts: MagicMock, mock_delay: MagicMock
    ) -> None:
        self._mock_org_contexts(mock_contexts)
        # The listener dispatches every submitted review, bots included; the repo
        # write-access gate is enforced downstream in the task, not here.
        with self.feature("organizations:autofix-pr-iteration-manual"):
            handle_pull_request_review_for_autofix_iteration(
                self._event(author_id="333333", is_bot=True)
            )
        mock_delay.assert_called_once()
        # Bot authorship is threaded through so the task can apply the streak cap.
        assert mock_delay.call_args.kwargs["author_is_bot"] is True
        assert mock_delay.call_args.kwargs["delivery_authenticated"] is True

    @patch(f"{TASK_PATH}.trigger_pr_iteration_from_review.delay")
    @patch(f"{REVIEW_PATH}.integration_service.organization_contexts")
    def test_unsigned_delivery_is_marked_unauthenticated(
        self, mock_contexts: MagicMock, mock_delay: MagicMock
    ) -> None:
        self._mock_org_contexts(mock_contexts)
        with self.feature("organizations:autofix-pr-iteration-manual"):
            handle_pull_request_review_for_autofix_iteration(
                self._event(is_bot=True, skipped_authentication=True)
            )
        mock_delay.assert_called_once()
        assert mock_delay.call_args.kwargs["delivery_authenticated"] is False

    @patch(f"{TASK_PATH}.trigger_pr_iteration_from_review.delay")
    @patch(f"{REVIEW_PATH}.integration_service.organization_contexts")
    def test_skips_when_manual_feature_disabled(
        self, mock_contexts: MagicMock, mock_delay: MagicMock
    ) -> None:
        self._mock_org_contexts(mock_contexts)
        # Automated CI iteration on, manual off: the review trigger is manual-only,
        # so the automated flag must not enable it.
        with self.feature("organizations:autofix-pr-iteration"):
            handle_pull_request_review_for_autofix_iteration(self._event())
        mock_delay.assert_not_called()

    @patch(f"{TASK_PATH}.trigger_pr_iteration_from_review.delay")
    @patch(f"{REVIEW_PATH}.integration_service.organization_contexts")
    def test_skips_when_no_integration(
        self, mock_contexts: MagicMock, mock_delay: MagicMock
    ) -> None:
        mock_contexts.return_value = MagicMock(integration=None, organization_integrations=[])
        with self.feature("organizations:autofix-pr-iteration-manual"):
            handle_pull_request_review_for_autofix_iteration(self._event())
        mock_delay.assert_not_called()

    @patch(f"{TASK_PATH}.trigger_pr_iteration_from_review.delay")
    @patch(f"{REVIEW_PATH}.integration_service.organization_contexts")
    def test_skips_github_enterprise(self, mock_contexts: MagicMock, mock_delay: MagicMock) -> None:
        # PR iteration is not supported on GHE, which delivers the same
        # pull_request_review events. It must be dropped here, before the
        # control-silo integration lookup and before any task is scheduled.
        self._mock_org_contexts(mock_contexts)
        with self.feature("organizations:autofix-pr-iteration-manual"):
            handle_pull_request_review_for_autofix_iteration(
                self._event(provider="github_enterprise")
            )
        assert mock_contexts.call_count == 0
        mock_delay.assert_not_called()

    @patch(f"{TASK_PATH}.trigger_pr_iteration_from_review.delay")
    @patch(f"{REVIEW_PATH}.integration_service.organization_contexts")
    def test_skips_when_missing_ids(self, mock_contexts: MagicMock, mock_delay: MagicMock) -> None:
        self._mock_org_contexts(mock_contexts)
        with self.feature("organizations:autofix-pr-iteration-manual"):
            handle_pull_request_review_for_autofix_iteration(self._event(installation_id=None))
        mock_delay.assert_not_called()


class _ScmStub:
    """Spec for the SCM client mock so the ``runtime_checkable`` protocol
    ``isinstance`` guards in the task pass (a bare ``MagicMock`` fails them)."""

    def get_pull_request(self, *args: Any, **kwargs: Any) -> Any: ...

    def get_review_comments(self, *args: Any, **kwargs: Any) -> Any: ...

    def get_pull_request_review(self, *args: Any, **kwargs: Any) -> Any: ...

    def get_repository_user_permission(self, *args: Any, **kwargs: Any) -> Any: ...

    def create_review_comment_reaction(self, *args: Any, **kwargs: Any) -> Any: ...


class TriggerPrIterationFromReviewTest(TestCase):
    mock_get_state: MagicMock
    mock_enqueue: MagicMock
    mock_consume: MagicMock
    mock_make_scm: MagicMock
    mock_actions: MagicMock
    mock_find_user: MagicMock

    def setUp(self) -> None:
        super().setUp()
        self.group = self.create_group(project=self.project)
        self.repo = self.create_repo(
            project=self.project,
            provider="integrations:github",
            external_id="123",
            name="owner/repo",
        )

        # Patch every external boundary the task touches once, and wire up the
        # happy path (a body-only review) so each test only overrides what it
        # exercises. The mocks are exposed as ``self.mock_*``.
        for attr, target in (
            ("mock_get_state", "get_agent_state_from_pr_id"),
            ("mock_enqueue", "try_enqueue_autofix_feedback"),
            ("mock_consume", "consume_queued_autofix_feedback.apply_async"),
            ("mock_make_scm", "make_scm"),
            ("mock_actions", "scm_actions"),
            ("mock_find_user", "find_user_for_scm_actor"),
        ):
            patcher = patch(f"{TASK_PATH}.{target}")
            setattr(self, attr, patcher.start())
            self.addCleanup(patcher.stop)

        self.mock_get_state.return_value = self._agent_state()
        self.mock_make_scm.return_value = MagicMock(spec=_ScmStub)
        self.mock_actions.get_pull_request.return_value = {"data": {"internal_id": "555"}}
        self.mock_actions.get_review_comments.return_value = self._paginated([])
        self.mock_actions.get_pull_request_review.return_value = self._review_result(
            {
                "id": "500",
                "html_url": "https://x/500",
                "body": "overall summary",
                "state": "changes_requested",
                "author": {"id": "999", "username": "reviewer"},
            }
        )
        # Default the author to a repo collaborator with write access; tests that
        # exercise the gate override this.
        self.mock_actions.get_repository_user_permission.return_value = {"data": {"perms": "write"}}
        self.mock_find_user.return_value = self.user

    def _agent_state(self, blocks: list[MemoryBlock] | None = None) -> SeerRunState:
        return SeerRunState(
            run_id=67890,
            blocks=blocks or [],
            status="completed",
            updated_at="2024-01-01T00:00:00Z",
            repo_pr_states={
                "owner/repo": RepoPRState(
                    repo_name="owner/repo", pr_url="https://example.com/pull/7"
                )
            },
            metadata={"group_id": self.group.id},
        )

    def _iteration_block(self, idx: int) -> MemoryBlock:
        return MemoryBlock(
            id=f"iter{idx}",
            message=Message(
                role="assistant",
                metadata={"step": "pr_iteration", "iteration_index": idx},
            ),
            timestamp="2024-01-01T00:00:00Z",
        )

    def _feedback_iteration_block(self, idx: int, *, author_is_bot: bool) -> MemoryBlock:
        """An iteration block carrying real serialized review feedback."""
        feedback = Feedback(
            source=GithubPrReviewBodyFeedbackSource(
                review_id=idx,
                body="fix this",
                author_is_bot=author_is_bot,
            )
        )
        return MemoryBlock(
            id=f"iter{idx}",
            message=Message(
                role="assistant",
                metadata={
                    "step": "pr_iteration",
                    "iteration_index": idx,
                    "feedback": serialize_feedback([feedback]),
                },
            ),
            timestamp="2024-01-01T00:00:00Z",
        )

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

    def _review_result(self, review: dict[str, Any]) -> dict[str, Any]:
        return {"data": review, "type": "github", "raw": {}}

    def _stored_pr(self, *, external_id: int | None = None) -> PullRequest:
        pr = self.create_pull_request(
            repository_id=self.repo.id,
            organization_id=self.organization.id,
            key="7",
        )
        if external_id is not None:
            pr.update(external_id=external_id)
        return pr

    def _run(
        self,
        author_username: str | None = "reviewer",
        author_external_id: str | int | None = "999",
        author_is_bot: bool = False,
        delivery_authenticated: bool = True,
    ) -> None:
        trigger_pr_iteration_from_review(
            organization_id=self.organization.id,
            repo_id=self.repo.id,
            integration_id=42,
            pr_number=7,
            review_id=500,
            author_username=author_username,
            author_external_id=author_external_id,
            author_is_bot=author_is_bot,
            delivery_authenticated=delivery_authenticated,
        )

    def test_resolves_pr_id_from_row_without_calling_github(self) -> None:
        # The pull_request_review payload carries only the PR number; a stored
        # ``external_id`` is what keeps that from costing a REST round-trip.
        self._stored_pr(external_id=555)

        self._run()

        self.mock_actions.get_pull_request.assert_not_called()
        self.mock_get_state.assert_called_once_with(
            self.organization.id, "integrations:github", 555
        )

    def test_writes_external_id_back_on_a_miss(self) -> None:
        pr = self._stored_pr()

        self._run()

        self.mock_actions.get_pull_request.assert_called_once_with(
            self.mock_make_scm.return_value, "7"
        )
        pr.refresh_from_db()
        assert pr.external_id == 555

    def test_stops_on_a_repo_whose_provider_is_not_pinned(self) -> None:
        # Everything downstream reads github.com off `PR_ITERATION_PROVIDER`
        # instead of the repo, so a GHE repo reaching this task would key its
        # per-instance repo id into a cache that only github.com ids are unique
        # in — and ask Seer for a run under the wrong provider. The listener
        # rejects GHE before dispatch; this pins that the task does not depend on
        # it having done so.
        self.repo.provider = "integrations:github_enterprise"
        self.repo.save()

        self._run()

        self.mock_make_scm.assert_not_called()
        self.mock_get_state.assert_not_called()
        self.mock_actions.get_pull_request.assert_not_called()
        assert not PullRequest.objects.filter(repository_id=self.repo.id, key="7").exists()

    def test_returns_when_get_pull_request_fails(self) -> None:
        self.mock_actions.get_pull_request.side_effect = ResourceNotFound()

        self._run()

        self.mock_get_state.assert_not_called()
        self.mock_enqueue.assert_not_called()
        assert not PullRequest.objects.filter(repository_id=self.repo.id, key="7").exists()

    def test_batch_review_with_inline_comments_and_body(self) -> None:
        self.mock_actions.get_review_comments.return_value = self._paginated(
            [
                self._review_comment(comment_id="1", body="fix this"),
                self._review_comment(comment_id="2", body="and this"),
            ]
        )

        self._run()

        # PR number -> id lookup before run lookup.
        self.mock_actions.get_pull_request.assert_called_once_with(
            self.mock_make_scm.return_value, "7"
        )
        self.mock_get_state.assert_called_once_with(
            self.organization.id, "integrations:github", 555
        )

        # Two inline comments + one review body item.
        assert self.mock_enqueue.call_count == 3
        sources = [c.kwargs["feedback"].source for c in self.mock_enqueue.call_args_list]
        comment_sources = [s for s in sources if isinstance(s, GithubPrReviewCommentFeedbackSource)]
        body_sources = [s for s in sources if isinstance(s, GithubPrReviewBodyFeedbackSource)]
        assert len(comment_sources) == 2
        assert len(body_sources) == 1
        assert body_sources[0].body == "overall summary"
        # The shared review id lands on every item from the review — both inline
        # comments and the body — so the UI can group them under one review. The
        # review's state lives on the body source (the review's representation).
        assert all(s.review_id == 500 for s in sources)
        assert body_sources[0].review_state == "changes_requested"
        # The SCM ``url`` maps onto the source's ``html_url``; the UI drops
        # comments without it, so this is what surfaces the feedback.
        assert {s.comment.html_url for s in comment_sources} == {
            "https://github.com/owner/repo/pull/7#discussion_r1",
            "https://github.com/owner/repo/pull/7#discussion_r2",
        }
        # The commenter's GitHub id rides along for commit attribution.
        assert all(
            s.comment.user is not None and s.comment.user.id == "999" for s in comment_sources
        )
        assert all(
            c.kwargs["referrer"] == AutofixReferrer.GITHUB_PR_REVIEW
            for c in self.mock_enqueue.call_args_list
        )
        assert all(
            c.kwargs["actor_user_id"] == self.user.id for c in self.mock_enqueue.call_args_list
        )
        self.mock_consume.assert_called_once()

        # Each inline comment is acked with :eyes: (the body has no reaction target).
        assert self.mock_actions.create_review_comment_reaction.call_count == 2
        reacted_ids = {
            c.args[2] for c in self.mock_actions.create_review_comment_reaction.call_args_list
        }
        assert reacted_ids == {"1", "2"}
        assert all(
            c.args[3] == "eyes"
            for c in self.mock_actions.create_review_comment_reaction.call_args_list
        )

    def test_paginates_review_comments(self) -> None:
        # A full first page (>= page size) must fetch a second page; every
        # paginated request must carry ``per_page`` (the GitHub provider reads it
        # unconditionally, so omitting it raises ``KeyError: 'per_page'``), and a
        # short second page terminates the loop. The review body is fetched
        # directly by id, so it does not paginate.
        full_page = [
            self._review_comment(comment_id=str(i), body=f"comment {i}")
            for i in range(_REVIEW_PAGE_SIZE)
        ]
        last_page = [self._review_comment(comment_id=str(_REVIEW_PAGE_SIZE), body="last one")]
        self.mock_actions.get_review_comments.side_effect = [
            self._paginated(full_page),
            self._paginated(last_page),
        ]

        self._run()

        # Two pages fetched for the inline comments; the review is a single fetch.
        assert self.mock_actions.get_review_comments.call_count == 2
        self.mock_actions.get_pull_request_review.assert_called_once_with(ANY, "7", "500")
        # per_page present and page number advances on every call.
        for call in self.mock_actions.get_review_comments.call_args_list:
            pagination = call.args[3]
            assert pagination["per_page"] == _REVIEW_PAGE_SIZE
        comment_pages = [
            c.args[3]["cursor"] for c in self.mock_actions.get_review_comments.call_args_list
        ]
        assert comment_pages == ["1", "2"]

        # All inline comments across both pages, plus the directly-fetched review body.
        sources = [c.kwargs["feedback"].source for c in self.mock_enqueue.call_args_list]
        comment_sources = [s for s in sources if isinstance(s, GithubPrReviewCommentFeedbackSource)]
        body_sources = [s for s in sources if isinstance(s, GithubPrReviewBodyFeedbackSource)]
        assert len(comment_sources) == _REVIEW_PAGE_SIZE + 1
        assert len(body_sources) == 1
        self.mock_consume.assert_called_once()

    def test_inline_comment_produces_file_line_anchor(self) -> None:
        self.mock_actions.get_review_comments.return_value = self._paginated(
            [self._review_comment(comment_id="1", body="no @sentry command here")]
        )

        self._run()

        source = self.mock_enqueue.call_args_list[0].kwargs["feedback"].source
        assert isinstance(source, GithubPrReviewCommentFeedbackSource)
        # Field mapping recovers the anchor from the SCM ReviewComment.
        assert source.file_path == "src/sentry/foo.py"
        assert source.line == 42
        assert source.start_line == 40
        # No @sentry command required on the review path.
        assert source.comment.id == 1
        assert "Inline comment on src/sentry/foo.py:40-42:" in source.text
        assert "no @sentry command here" in source.text

    def test_body_only_review(self) -> None:
        # setUp's default is a body-only review with no inline comments.
        self._run()

        self.mock_enqueue.assert_called_once()
        source = self.mock_enqueue.call_args.kwargs["feedback"].source
        assert isinstance(source, GithubPrReviewBodyFeedbackSource)
        assert source.body == "overall summary"
        assert source.review_id == 500
        assert source.review_state == "changes_requested"
        # The author rides on the body source's ``user`` (the same shape an inline
        # comment carries) so the UI can render the reviewer's avatar on the header.
        assert source.user is not None
        assert source.user.login == "reviewer"
        # The GitHub id rides along so commit attribution can build the noreply email.
        assert source.user.id == "999"

        # A body-only review has no inline comment to react to.
        self.mock_actions.create_review_comment_reaction.assert_not_called()

    def test_body_author_read_from_review_not_gate_actor(self) -> None:
        # The body avatar author comes from the fetched review's author, not the
        # write-access gate's actor. Set them to different logins to prove the
        # source is the review payload (mirroring how a comment reads its author).
        self.mock_actions.get_pull_request_review.return_value = self._review_result(
            {
                "id": "500",
                "html_url": "https://x/500",
                "body": "overall summary",
                "state": "changes_requested",
                "author": {"id": "42", "username": "review-author"},
            }
        )

        self._run(author_username="gate-actor")

        source = self.mock_enqueue.call_args.kwargs["feedback"].source
        assert isinstance(source, GithubPrReviewBodyFeedbackSource)
        assert source.user is not None
        assert source.user.login == "review-author"

    def test_single_comment_review(self) -> None:
        # GitHub's "Add single comment" fires a review with state=commented, one
        # inline comment and no body.
        self.mock_actions.get_review_comments.return_value = self._paginated(
            [self._review_comment(comment_id="1", body="typo")]
        )
        self.mock_actions.get_pull_request_review.return_value = self._review_result(
            {"id": "500", "html_url": "https://x/500", "body": ""}
        )

        self._run()

        self.mock_enqueue.assert_called_once()
        source = self.mock_enqueue.call_args.kwargs["feedback"].source
        assert isinstance(source, GithubPrReviewCommentFeedbackSource)

        # The single inline comment is acked with :eyes:.
        self.mock_actions.create_review_comment_reaction.assert_called_once()
        assert self.mock_actions.create_review_comment_reaction.call_args.args[2] == "1"
        assert self.mock_actions.create_review_comment_reaction.call_args.args[3] == "eyes"

    def test_empty_review_is_skipped(self) -> None:
        # A bare approve: no body text AND no inline comments.
        self.mock_actions.get_pull_request_review.return_value = self._review_result(
            {"id": "500", "html_url": "https://x/500", "body": ""}
        )

        self._run()

        self.mock_enqueue.assert_not_called()
        self.mock_consume.assert_not_called()

    def test_looks_good_review_is_not_skipped(self) -> None:
        # "looks good" has content, so it is passed through to the agent.
        self.mock_actions.get_pull_request_review.return_value = self._review_result(
            {"id": "500", "html_url": "https://x/500", "body": "looks good"}
        )

        self._run()

        self.mock_enqueue.assert_called_once()
        source = self.mock_enqueue.call_args.kwargs["feedback"].source
        assert isinstance(source, GithubPrReviewBodyFeedbackSource)
        assert source.body == "looks good"

    def test_review_not_found_still_processes_inline_comments(self) -> None:
        # If the review is gone (deleted/dismissed between webhook and task) the
        # direct fetch 404s; we treat it as no body but still act on the inline
        # comments we fetched.
        self.mock_actions.get_review_comments.return_value = self._paginated(
            [self._review_comment(comment_id="1", body="fix this")]
        )
        self.mock_actions.get_pull_request_review.side_effect = ResourceNotFound()

        self._run()

        # Only the inline comment becomes feedback; no body source is emitted.
        self.mock_enqueue.assert_called_once()
        source = self.mock_enqueue.call_args.kwargs["feedback"].source
        assert isinstance(source, GithubPrReviewCommentFeedbackSource)
        # The review 404'd, but the inline comment still flows through, tagged with
        # its review id for grouping (no body source is emitted to carry state).
        assert source.review_id == 500

    def test_skips_when_no_agent_state(self) -> None:
        self.mock_get_state.return_value = None

        self._run()

        self.mock_actions.get_review_comments.assert_not_called()
        self.mock_enqueue.assert_not_called()
        self.mock_consume.assert_not_called()

    def test_skips_bot_review_when_automated_streak_capped(self) -> None:
        # A bot review past the automated-iteration streak cap is dropped before
        # enqueueing or :eyes:-acking any inline comment — otherwise reviewers see
        # an ack for feedback that never produces an iteration. (Iterations with no
        # human feedback count as automated, so two bare iterations trip a cap of 2.)
        self.mock_get_state.return_value = self._agent_state(
            blocks=[self._iteration_block(1), self._iteration_block(2)]
        )
        self.mock_actions.get_review_comments.return_value = self._paginated(
            [self._review_comment(comment_id="1", body="fix this")]
        )

        with self.options({"autofix.pr-iteration.max-iterations": 2}):
            self._run(author_is_bot=True)

        self.mock_actions.get_review_comments.assert_not_called()
        self.mock_enqueue.assert_not_called()
        self.mock_consume.assert_not_called()
        self.mock_actions.create_review_comment_reaction.assert_not_called()
        # The cap drops the bot, not the write-access gate.
        self.mock_actions.get_repository_user_permission.assert_not_called()

    def test_bot_review_capped_when_prior_iterations_recorded_bot_feedback(self) -> None:
        # Bot reviews recorded as automated feedback trip the cap, so bot-vs-agent
        # ping-pong is bounded even though the bot skips the write-access gate.
        self.mock_get_state.return_value = self._agent_state(
            blocks=[
                self._feedback_iteration_block(1, author_is_bot=True),
                self._feedback_iteration_block(2, author_is_bot=True),
            ]
        )
        self.mock_actions.get_review_comments.return_value = self._paginated(
            [self._review_comment(comment_id="1", body="fix this")]
        )

        with self.options({"autofix.pr-iteration.max-iterations": 2}):
            self._run(author_is_bot=True)

        self.mock_enqueue.assert_not_called()
        self.mock_consume.assert_not_called()
        self.mock_actions.create_review_comment_reaction.assert_not_called()

    def test_bot_review_proceeds_when_prior_iteration_had_human_feedback(self) -> None:
        # One human feedback item in a drained iteration makes it manual, which
        # breaks the streak and lets the next bot review through.
        self.mock_get_state.return_value = self._agent_state(
            blocks=[
                self._feedback_iteration_block(1, author_is_bot=False),
                self._feedback_iteration_block(2, author_is_bot=True),
            ]
        )
        self.mock_actions.get_review_comments.return_value = self._paginated(
            [self._review_comment(comment_id="1", body="fix this")]
        )

        with self.options({"autofix.pr-iteration.max-iterations": 2}):
            self._run(author_is_bot=True)

        self.mock_enqueue.assert_called()
        self.mock_consume.assert_called_once()

    def test_human_review_proceeds_when_automated_streak_capped(self) -> None:
        # The streak cap only bounds automated (bot) reviews; a human review always
        # drives an iteration and resets the streak, even past the cap.
        self.mock_get_state.return_value = self._agent_state(
            blocks=[self._iteration_block(1), self._iteration_block(2)]
        )
        self.mock_actions.get_review_comments.return_value = self._paginated(
            [self._review_comment(comment_id="1", body="fix this")]
        )

        with self.options({"autofix.pr-iteration.max-iterations": 2}):
            self._run(author_is_bot=False)

        self.mock_enqueue.assert_called()
        self.mock_consume.assert_called_once()

    def test_skips_review_without_repo_write_access(self) -> None:
        # A reviewer lacking write/admin can't drive an iteration: drop before
        # enqueueing or :eyes:-acking so their feedback isn't acted on.
        self.mock_actions.get_repository_user_permission.return_value = {"data": {"perms": "read"}}
        self.mock_actions.get_review_comments.return_value = self._paginated(
            [self._review_comment(comment_id="1", body="fix this")]
        )

        self._run()

        self.mock_enqueue.assert_not_called()
        self.mock_consume.assert_not_called()
        self.mock_actions.create_review_comment_reaction.assert_not_called()

    def test_bot_review_proceeds_without_repo_write_access(self) -> None:
        # A bot account is never a repo collaborator, so it skips the gate.
        self.mock_actions.get_repository_user_permission.return_value = {"data": {"perms": "none"}}
        self.mock_actions.get_review_comments.return_value = self._paginated(
            [self._review_comment(comment_id="1", body="fix this")]
        )

        self._run(author_is_bot=True)

        self.mock_enqueue.assert_called()
        self.mock_consume.assert_called_once()
        self.mock_actions.get_repository_user_permission.assert_not_called()
        self.mock_actions.create_review_comment_reaction.assert_called_once()

        # The review still counts as automated, so the streak cap can stop it later.
        self.mock_find_user.assert_not_called()
        sources = [c.kwargs["feedback"].source for c in self.mock_enqueue.call_args_list]
        assert all(s.author_is_bot for s in sources)
        assert all(c.kwargs["actor_user_id"] is None for c in self.mock_enqueue.call_args_list)

    def test_unauthenticated_bot_review_still_needs_write_access(self) -> None:
        # A legacy GitHub Enterprise host can deliver without a verified signature,
        # so the bot flag is forgeable and must not skip the gate.
        self.mock_actions.get_repository_user_permission.return_value = {"data": {"perms": "none"}}
        self.mock_actions.get_review_comments.return_value = self._paginated(
            [self._review_comment(comment_id="1", body="fix this")]
        )

        self._run(author_is_bot=True, delivery_authenticated=False)

        self.mock_actions.get_repository_user_permission.assert_called_once()
        self.mock_enqueue.assert_not_called()
        self.mock_consume.assert_not_called()
        self.mock_actions.create_review_comment_reaction.assert_not_called()

    def test_bot_review_proceeds_without_author_username(self) -> None:
        # GitHub always sends a login, but the bot path must not depend on one.
        self.mock_actions.get_review_comments.return_value = self._paginated(
            [self._review_comment(comment_id="1", body="fix this")]
        )

        self._run(author_username=None, author_is_bot=True)

        self.mock_enqueue.assert_called()
        self.mock_consume.assert_called_once()
        self.mock_actions.get_repository_user_permission.assert_not_called()

    def test_skips_review_with_no_author(self) -> None:
        # No author username means we can't check access, so drop without even
        # calling the permission endpoint.
        self._run(author_username=None)

        self.mock_actions.get_repository_user_permission.assert_not_called()
        self.mock_enqueue.assert_not_called()
        self.mock_consume.assert_not_called()
