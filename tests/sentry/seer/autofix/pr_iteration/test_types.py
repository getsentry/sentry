from datetime import timedelta
from unittest.mock import MagicMock, patch

import pytest
from pydantic import ValidationError

from sentry.seer.agent.client_models import MemoryBlock, Message, RepoPRState, SeerRunState
from sentry.seer.autofix.pr_iteration.feedback import (
    Feedback,
    parse_feedback,
    serialize_feedback,
)
from sentry.seer.autofix.pr_iteration.feedback_sources.base import ConsumeTask
from sentry.seer.autofix.pr_iteration.feedback_sources.check_suite import (
    CheckSuiteAutofixRun,
    CheckSuiteFeedbackSource,
    GithubCheckSuiteEvent,
    MissingCheckSuiteAutofixRun,
    get_check_suite_url,
    resolve_check_suite_repositories,
)
from sentry.seer.autofix.pr_iteration.feedback_sources.github_comment import (
    GithubIssueComment,
    GithubPrCommentFeedbackSource,
    GithubPrReviewBodyFeedbackSource,
    GithubPrReviewCommentFeedbackSource,
)
from sentry.seer.autofix.pr_iteration.feedback_sources.user_ui import UserUIFeedbackSource
from sentry.testutils.cases import TestCase
from sentry.utils import json

CHECK_SUITE_SOURCE_PATH = "sentry.seer.autofix.pr_iteration.feedback_sources.check_suite"


def _check_suite_event(*, updated_at: str | None = "2024-01-01T00:00:00Z") -> dict:
    check_suite: dict = {
        "id": 1,
        "head_sha": "abc",
        "check_runs_url": "https://github.com/owner/repo/check-runs",
        "app": {"name": "CI"},
    }
    if updated_at is not None:
        check_suite["updated_at"] = updated_at
    return {
        "check_suite": check_suite,
        "repository": {"html_url": "https://github.com/owner/repo"},
    }


def _run_state(*, blocks=None, repo_pr_states=None, status="completed") -> SeerRunState:
    return SeerRunState(
        run_id=1,
        blocks=blocks or [],
        status=status,
        updated_at="2024-01-01T00:00:00Z",
        repo_pr_states=repo_pr_states or {},
    )


def _autofix_run(*, repo: MagicMock | None = None) -> CheckSuiteAutofixRun:
    return CheckSuiteAutofixRun(
        repository=repo or MagicMock(organization_id=1, id=2),
        run_state=_run_state(),
        pr_id=1,
        group_id=1,
    )


def _check_suite_source(
    event: dict | None = None,
    *,
    autofix_run: CheckSuiteAutofixRun | None = None,
) -> CheckSuiteFeedbackSource:
    source = CheckSuiteFeedbackSource(event=event or _check_suite_event())
    if autofix_run is not None:
        with patch(
            f"{CHECK_SUITE_SOURCE_PATH}.resolve_check_suite_autofix_run",
            return_value=autofix_run,
        ):
            assert source.autofix_run is autofix_run
    return source


def _feedback_block(*feedbacks: Feedback) -> MemoryBlock:
    return MemoryBlock(
        id="block-1",
        message=Message(role="assistant", metadata={"feedback": serialize_feedback(feedbacks)}),
        timestamp="2024-01-01T00:00:00Z",
    )


def _review_feedback(
    file_path: str | None = "src/sentry/foo.py",
    line: int | None = 42,
    start_line: int | None = None,
    diff_hunk: str | None = None,
) -> Feedback:
    return Feedback(
        source=GithubPrReviewCommentFeedbackSource(
            comment={
                "id": 1,
                "body": "fix it",
                "path": file_path,
                "line": line,
                "start_line": start_line,
                "diff_hunk": diff_hunk,
            },
        ),
    )


class ParseSerializeFeedbackTest(TestCase):
    def test_check_suite_event_requires_expected_fields_and_preserves_extra_fields(self) -> None:
        event = _check_suite_event()
        event["extra"] = "value"
        source = _check_suite_source(event)

        assert source.event.dict()["extra"] == "value"
        assert source.app_name == "CI"
        assert get_check_suite_url(source.event) == (
            "https://github.com/owner/repo/commit/abc/checks?check_suite_id=1"
        )
        assert source.check_suite_url == get_check_suite_url(source.event)
        assert source.updated_at == "2024-01-01T00:00:00Z"
        assert source.event.check_suite.updated_at == "2024-01-01T00:00:00Z"
        assert "updated_at" not in source.dict()
        assert "autofix_run" not in source.dict()

        del event["check_suite"]["check_runs_url"]
        with pytest.raises(ValidationError):
            CheckSuiteFeedbackSource(event=event)

    def test_construct_does_not_resolve(self) -> None:
        with patch(f"{CHECK_SUITE_SOURCE_PATH}.resolve_check_suite_autofix_run") as mock_resolve:
            source = CheckSuiteFeedbackSource(event=_check_suite_event())
            mock_resolve.assert_not_called()
            assert source._autofix_run is None

    def test_autofix_run_resolves_and_caches(self) -> None:
        run = _autofix_run()
        source = CheckSuiteFeedbackSource(event=_check_suite_event())
        with patch(
            f"{CHECK_SUITE_SOURCE_PATH}.resolve_check_suite_autofix_run",
            return_value=run,
        ) as mock_resolve:
            assert source.autofix_run is run
            assert source.autofix_run is run
            mock_resolve.assert_called_once()

    def test_autofix_run_raises_when_missing(self) -> None:
        source = CheckSuiteFeedbackSource(event=_check_suite_event())
        with patch(
            f"{CHECK_SUITE_SOURCE_PATH}.resolve_check_suite_autofix_run",
            return_value=None,
        ):
            with pytest.raises(MissingCheckSuiteAutofixRun):
                _ = source.autofix_run

    def test_round_trips_all_source_types(self) -> None:
        items = [
            Feedback(source=UserUIFeedbackSource(user_id=7, user_feedback="ui")),
            Feedback(
                source=GithubPrCommentFeedbackSource(comment={"id": 99, "body": "@sentry comment"})
            ),
            Feedback(source=_check_suite_source()),
        ]

        with patch(f"{CHECK_SUITE_SOURCE_PATH}.resolve_check_suite_autofix_run") as mock_resolve:
            parsed = parse_feedback(serialize_feedback(items))

        # text is derived from each source: user-ui echoes the typed feedback,
        # pr-comment parses the comment body, check-suite builds an instruction.
        assert parsed[0].text == "ui"
        assert parsed[1].text == "comment"
        assert parsed[2].text.startswith("A GitHub check suite on the pull request failed")
        assert isinstance(parsed[0].source, UserUIFeedbackSource)
        assert isinstance(parsed[1].source, GithubPrCommentFeedbackSource)
        assert isinstance(parsed[2].source, CheckSuiteFeedbackSource)
        assert parsed[0].source.user_id == 7
        assert parsed[1].source.comment.id == 99
        # Re-parse must not re-hit Seer.
        mock_resolve.assert_not_called()
        assert parsed[2].source._autofix_run is None

    def test_parses_single_object(self) -> None:
        feedback = Feedback(source=UserUIFeedbackSource(user_id=1, user_feedback="solo"))

        parsed = parse_feedback(feedback.json())

        assert len(parsed) == 1
        assert parsed[0].text == "solo"

    def test_serializes_ui_text(self) -> None:
        items = [
            Feedback(source=UserUIFeedbackSource(user_id=7, user_feedback="ui")),
            Feedback(source=_check_suite_source()),
        ]

        serialized = serialize_feedback(items)

        parsed = parse_feedback(serialized)
        # user-ui has no distinct UI text, so it falls back to `text`.
        assert parsed[0].source.ui_text is None
        assert parsed[0].ui_text == "ui"
        assert parsed[1].source.ui_text == "check suite for app CI failed"
        assert parsed[1].ui_text == "check suite for app CI failed"

    def test_invalid_json_returns_empty(self) -> None:
        assert parse_feedback("not json") == []

    def test_schema_mismatch_returns_empty(self) -> None:
        assert parse_feedback('{"unexpected": true}') == []

    def test_parses_check_suite_without_resolve(self) -> None:
        with patch(f"{CHECK_SUITE_SOURCE_PATH}.resolve_check_suite_autofix_run") as mock_resolve:
            raw = json.dumps(
                {
                    "source": {
                        "type": "check-suite",
                        "event": _check_suite_event(),
                    }
                }
            )
            parsed = parse_feedback(raw)

        assert len(parsed) == 1
        assert isinstance(parsed[0].source, CheckSuiteFeedbackSource)
        assert parsed[0].source._autofix_run is None
        mock_resolve.assert_not_called()

    def test_bad_item_skips_keeps_siblings(self) -> None:
        # One invalid element must not erase sibling feedback in the same list
        # (hard-cap / comment / attempt dedupe rely on it).
        raw = json.dumps(
            [
                {
                    "source": {
                        "type": "user-ui",
                        "user_id": 7,
                        "user_feedback": "keep me",
                    }
                },
                {
                    "source": {
                        "type": "check-suite",
                        "event": {"check_suite": {"id": 1}},
                    }
                },
                {
                    "source": {
                        "type": "github-pr-comment",
                        "comment": {"id": 99, "body": "@sentry also keep"},
                    }
                },
            ]
        )

        parsed = parse_feedback(raw)

        assert len(parsed) == 2
        assert isinstance(parsed[0].source, UserUIFeedbackSource)
        assert parsed[0].text == "keep me"
        assert isinstance(parsed[1].source, GithubPrCommentFeedbackSource)
        assert parsed[1].text == "also keep"

    def test_ignores_legacy_check_run_ids_on_parse(self) -> None:
        raw = json.dumps(
            {
                "source": {
                    "type": "check-suite",
                    "event": _check_suite_event(),
                    "check_run_ids": [101],
                }
            }
        )

        parsed = parse_feedback(raw)
        assert len(parsed) == 1
        assert isinstance(parsed[0].source, CheckSuiteFeedbackSource)
        assert "check_run_ids" not in parsed[0].source.dict()


class FeedbackBackwardsCompatTest(TestCase):
    """Feedback serialized before sources derived their own `text` stored it at
    the top level, and `UserUIFeedbackSource` had no `user_feedback` field. Old
    run_state blocks in Seer can retain that shape indefinitely, so parsing it
    must still work and produce the same `text`/`ui_text`.
    """

    def test_parses_old_user_ui_format_without_user_feedback_field(self) -> None:
        raw = '{"text": "please fix", "source": {"type": "user-ui", "user_id": 5, "user": null}}'

        parsed = parse_feedback(raw)

        assert len(parsed) == 1
        assert isinstance(parsed[0].source, UserUIFeedbackSource)
        assert parsed[0].source.user_feedback == ""
        assert parsed[0].text == "please fix"
        assert parsed[0].ui_text == "please fix"

    def test_parses_old_github_pr_comment_format_without_comment_feedback(self) -> None:
        raw = (
            '{"text": "please look at this PR", "source": '
            '{"type": "github-pr-comment", "comment": '
            '{"id": 42, "body": "please look at this PR\\n\\n@sentry"}}}'
        )

        parsed = parse_feedback(raw)

        assert len(parsed) == 1
        assert isinstance(parsed[0].source, GithubPrCommentFeedbackSource)
        assert parsed[0].text == "please look at this PR"
        assert parsed[0].ui_text == "please look at this PR"

    def test_parses_old_format_list(self) -> None:
        raw = (
            "["
            '{"text": "old ui feedback", "source": '
            '{"type": "user-ui", "user_id": 1, "user": null}},'
            '{"text": "old comment feedback", "source": '
            '{"type": "github-pr-comment", "comment": '
            '{"id": 7, "body": "old comment feedback\\n\\n@sentry"}}}'
            "]"
        )

        parsed = parse_feedback(raw)

        assert [f.text for f in parsed] == ["old ui feedback", "old comment feedback"]

    def test_reserializing_old_format_upgrades_to_new_format(self) -> None:
        raw = '{"text": "please fix", "source": {"type": "user-ui", "user_id": 5, "user": null}}'

        parsed = parse_feedback(raw)
        upgraded = json.loads(serialize_feedback(parsed))[0]

        # Old blobs had no `ui_text` key at all; the new shape always has one.
        assert "ui_text" in upgraded
        assert upgraded["text"] == "please fix"
        assert upgraded["ui_text"] == "please fix"
        assert upgraded["source"]["type"] == "user-ui"

    def test_new_format_serializes_and_reparses_without_relying_on_fallback(self) -> None:
        # New writes never populate the old top-level `text`/`ui_text` fields
        # by hand -- they're derived from `source` on load. Confirm the round
        # trip still works now that sources carry their own text.
        item = Feedback(source=UserUIFeedbackSource(user_id=9, user_feedback="new format"))

        parsed = parse_feedback(serialize_feedback([item]))

        assert isinstance(parsed[0].source, UserUIFeedbackSource)
        assert parsed[0].source.user_feedback == "new format"
        assert parsed[0].text == "new format"
        assert parsed[0].ui_text == "new format"


class GithubPrCommentTextTest(TestCase):
    def test_derives_feedback_from_comment(self) -> None:
        # The validator turns the comment into feedback once; text reads it back.
        source = GithubPrCommentFeedbackSource(comment={"id": 1, "body": "@sentry parsed"})
        assert isinstance(source.comment, GithubIssueComment)
        assert source.comment_feedback == "parsed"
        assert source.text == "parsed"

    def test_ignores_supplied_comment_feedback(self) -> None:
        # `comment` is the source of truth; a passed-in value is overwritten.
        source = GithubPrCommentFeedbackSource(
            comment={"id": 1, "body": "@sentry real"}, comment_feedback="fake"
        )
        assert source.text == "real"

    def test_raises_when_comment_is_not_iterate_command(self) -> None:
        with pytest.raises(ValidationError):
            GithubPrCommentFeedbackSource(comment={"id": 1, "body": "just a comment"})


class GithubPrCommentShouldConsumeTest(TestCase):
    def test_false_when_comment_already_processed(self) -> None:
        processed = Feedback(
            source=GithubPrCommentFeedbackSource(comment={"id": 555, "body": "@sentry a"})
        )
        state = _run_state(blocks=[_feedback_block(processed)])
        source = GithubPrCommentFeedbackSource(comment={"id": 555, "body": "@sentry a"})

        assert source.should_consume(state) is False

    def test_true_when_comment_unseen(self) -> None:
        processed = Feedback(
            source=GithubPrCommentFeedbackSource(comment={"id": 555, "body": "@sentry a"})
        )
        state = _run_state(blocks=[_feedback_block(processed)])
        source = GithubPrCommentFeedbackSource(comment={"id": 777, "body": "@sentry b"})

        assert source.should_consume(state) is True

    def test_true_when_comment_id_missing(self) -> None:
        source = GithubPrCommentFeedbackSource(comment={"body": "@sentry a"})

        assert source.should_consume(_run_state()) is True


class GithubPrReviewCommentTextTest(TestCase):
    def test_text_includes_range_anchor(self) -> None:
        feedback = _review_feedback(line=42, start_line=40)
        assert feedback.text == "Inline comment on src/sentry/foo.py:40-42:\nfix it"
        assert feedback.ui_text == "fix it"

    def test_text_includes_single_line_anchor(self) -> None:
        feedback = _review_feedback(line=42, start_line=None)
        assert feedback.text == "Inline comment on src/sentry/foo.py:42:\nfix it"
        assert feedback.ui_text == "fix it"

    def test_text_collapsed_range_uses_single_line(self) -> None:
        # start_line == line: GitHub effectively treats this as single-line.
        feedback = _review_feedback(line=42, start_line=42)
        assert feedback.text == "Inline comment on src/sentry/foo.py:42:\nfix it"
        assert feedback.ui_text == "fix it"

    def test_text_file_only_anchor(self) -> None:
        feedback = _review_feedback(line=None, start_line=None)
        assert feedback.text == "Inline comment on src/sentry/foo.py:\nfix it"
        assert feedback.ui_text == "fix it"

    def test_text_falls_back_to_diff_hunk_when_no_line(self) -> None:
        # GitHub's legacy review-comment listing returns position/diff_hunk but no
        # resolved line; use the hunk so the agent still sees the exact code.
        hunk = "@@ -19,5 +19,5 @@\n-    old line\n+    new line"
        feedback = _review_feedback(line=None, start_line=None, diff_hunk=hunk)
        assert feedback.text == f"Inline comment on src/sentry/foo.py at diff hunk:\n{hunk}\nfix it"
        assert feedback.ui_text == "fix it"

    def test_text_prefers_line_anchor_over_diff_hunk(self) -> None:
        feedback = _review_feedback(line=42, diff_hunk="@@ -1 +1 @@")
        assert feedback.text == "Inline comment on src/sentry/foo.py:42:\nfix it"
        assert feedback.ui_text == "fix it"

    def test_text_no_file_path_passes_through(self) -> None:
        feedback = _review_feedback(file_path=None, line=None)
        assert feedback.text == "fix it"
        assert feedback.ui_text == "fix it"

    def test_text_line_without_file_path_passes_through(self) -> None:
        # A line without a file_path can't be anchored (anchor() -> None), so it
        # must not render "Inline comment on None:"; fall through to plain text.
        feedback = _review_feedback(file_path=None, line=42)
        assert feedback.text == "fix it"
        assert feedback.ui_text == "fix it"

    def test_text_line_without_file_path_falls_back_to_diff_hunk(self) -> None:
        # Same, but a diff hunk is present: use it rather than the bogus anchor.
        hunk = "@@ -1 +1 @@"
        feedback = _review_feedback(file_path=None, line=42, diff_hunk=hunk)
        assert feedback.text == "fix it"
        assert feedback.ui_text == "fix it"


class GithubPrReviewCommentRequireCommandTest(TestCase):
    def test_require_command_is_false_on_class(self) -> None:
        # ``require_command`` is a per-subclass contract, not a per-instance flag:
        # review comments never gate on the @sentry command.
        assert GithubPrReviewCommentFeedbackSource.require_command is False
        assert GithubPrCommentFeedbackSource.require_command is True

    def test_verbatim_body_without_command(self) -> None:
        # The review path opts out of the @sentry command gate, so the raw body
        # is used verbatim even without a command.
        source = GithubPrReviewCommentFeedbackSource(
            comment={"id": 1, "body": "please rename this", "path": "a.py", "line": 5},
        )
        assert source.comment_feedback == "please rename this"
        assert source.text == "Inline comment on a.py:5:\nplease rename this"

    def test_round_trips(self) -> None:
        source = GithubPrReviewCommentFeedbackSource(
            comment={"id": 1, "body": "no command", "path": "a.py", "line": 5},
        )
        parsed = parse_feedback(Feedback(source=source).json())
        assert isinstance(parsed[0].source, GithubPrReviewCommentFeedbackSource)
        assert parsed[0].source.require_command is False
        assert parsed[0].text == "Inline comment on a.py:5:\nno command"


class GithubPrReviewBodyTest(TestCase):
    def test_text_is_body(self) -> None:
        source = GithubPrReviewBodyFeedbackSource(review_id=5, body="overall summary")
        assert source.text == "overall summary"
        assert Feedback(source=source).text == "overall summary"

    def test_round_trips(self) -> None:
        source = GithubPrReviewBodyFeedbackSource(
            review_id=5, body="overall summary", html_url="https://x/5"
        )
        parsed = parse_feedback(Feedback(source=source).json())
        assert isinstance(parsed[0].source, GithubPrReviewBodyFeedbackSource)
        assert parsed[0].source.review_id == 5
        assert parsed[0].source.body == "overall summary"
        assert parsed[0].source.html_url == "https://x/5"

    def test_should_consume_false_when_review_already_processed(self) -> None:
        processed = Feedback(source=GithubPrReviewBodyFeedbackSource(review_id=5, body="a"))
        state = _run_state(blocks=[_feedback_block(processed)])
        source = GithubPrReviewBodyFeedbackSource(review_id=5, body="a")
        assert source.should_consume(state) is False

    def test_should_consume_true_when_review_unseen(self) -> None:
        processed = Feedback(source=GithubPrReviewBodyFeedbackSource(review_id=5, body="a"))
        state = _run_state(blocks=[_feedback_block(processed)])
        source = GithubPrReviewBodyFeedbackSource(review_id=6, body="b")
        assert source.should_consume(state) is True

    def test_should_consume_true_when_review_id_missing(self) -> None:
        source = GithubPrReviewBodyFeedbackSource(body="a")
        assert source.should_consume(_run_state()) is True


class ConsumeTaskTest(TestCase):
    def test_now_returns_no_countdown(self) -> None:
        assert ConsumeTask.Now.countdown() is None

    def test_later_with_timedelta(self) -> None:
        task = ConsumeTask.Later(when=timedelta(seconds=30))
        assert task.countdown() == 30

    def test_later_with_negative_timedelta_returns_zero(self) -> None:
        task = ConsumeTask.Later(when=timedelta(seconds=-10))
        assert task.countdown() == 0


class CheckSuiteShouldQueueTest(TestCase):
    def _event(self, *, head_sha="abc", repo_name="owner/repo") -> dict:
        return {
            "check_suite": {
                "id": 1,
                "head_sha": head_sha,
                "check_runs_url": "https://github.com/owner/repo/check-runs",
                "app": {"name": "CI"},
            },
            "repository": {
                "full_name": repo_name,
                "html_url": "https://github.com/owner/repo",
            },
        }

    def test_true_when_matches_repo_pr_state(self) -> None:
        source = _check_suite_source(self._event())
        state = _run_state(
            repo_pr_states={"owner/repo": RepoPRState(repo_name="owner/repo", commit_sha="abc")}
        )

        assert source.should_queue(state) is True

    def test_false_when_only_matches_block_commit_sha(self) -> None:
        # A past block's SHA no longer counts: only the PR's current head
        # (repo_pr_states) is valid, so a suite for a superseded commit is dropped.
        source = _check_suite_source(self._event())
        block = MemoryBlock(
            id="b1",
            message=Message(role="assistant"),
            timestamp="2024-01-01T00:00:00Z",
            pr_commit_shas={"owner/repo": "abc"},
        )

        assert source.should_queue(_run_state(blocks=[block])) is False

    def test_false_when_no_match(self) -> None:
        source = _check_suite_source(self._event())
        state = _run_state(
            repo_pr_states={
                "owner/repo": RepoPRState(repo_name="owner/repo", commit_sha="different")
            }
        )

        assert source.should_queue(state) is False

    def test_false_when_missing_head_sha(self) -> None:
        source = _check_suite_source(self._event(head_sha=""))

        assert source.should_queue(_run_state()) is False

    def test_false_when_missing_repo_name(self) -> None:
        source = _check_suite_source(self._event(repo_name=""))

        assert source.should_queue(_run_state()) is False


class CheckSuiteShouldConsumeTest(TestCase):
    def _event(
        self,
        *,
        head_sha="abc",
        repo_name="owner/repo",
        updated_at: str | None = "2024-01-01T00:00:00Z",
        suite_id: int = 1,
    ) -> dict:
        check_suite: dict = {
            "id": suite_id,
            "head_sha": head_sha,
            "check_runs_url": "https://github.com/owner/repo/check-runs",
            "app": {"name": "CI"},
        }
        if updated_at is not None:
            check_suite["updated_at"] = updated_at
        return {
            "check_suite": check_suite,
            "repository": {
                "full_name": repo_name,
                "html_url": "https://github.com/owner/repo",
            },
        }

    def _state_with_prior(self, prior: Feedback) -> SeerRunState:
        block = MemoryBlock(
            id="iter-0",
            message=Message(
                role="assistant",
                metadata={
                    "step": "pr_iteration",
                    "iteration_index": "0",
                    "feedback": serialize_feedback([prior]),
                },
            ),
            timestamp="2024-01-01T00:00:00Z",
        )
        return _run_state(
            blocks=[block],
            repo_pr_states={"owner/repo": RepoPRState(repo_name="owner/repo", commit_sha="abc")},
        )

    def test_true_when_matches_current_head(self) -> None:
        source = _check_suite_source(self._event())
        state = _run_state(
            repo_pr_states={"owner/repo": RepoPRState(repo_name="owner/repo", commit_sha="abc")}
        )

        assert source.should_consume(state) is True

    def test_false_when_head_superseded(self) -> None:
        # PR head advanced past the commit the suite ran on -> out of date.
        source = _check_suite_source(self._event())
        state = _run_state(
            repo_pr_states={"owner/repo": RepoPRState(repo_name="owner/repo", commit_sha="newer")}
        )

        assert source.should_consume(state) is False

    def test_false_when_no_repo_pr_state(self) -> None:
        source = _check_suite_source(self._event())

        assert source.should_consume(_run_state()) is False

    def test_false_when_same_suite_same_updated_at(self) -> None:
        """Webhook retry: same suite id + updated_at → already processed."""
        source = _check_suite_source(self._event(updated_at="2024-01-01T00:00:00Z"))
        prior = Feedback(source=_check_suite_source(self._event(updated_at="2024-01-01T00:00:00Z")))

        assert source.should_consume(self._state_with_prior(prior)) is False

    def test_true_when_same_suite_new_updated_at(self) -> None:
        """GitHub Actions re-run: same suite id, bumped updated_at → consume."""
        source = _check_suite_source(self._event(updated_at="2024-01-02T00:00:00Z"))
        prior = Feedback(source=_check_suite_source(self._event(updated_at="2024-01-01T00:00:00Z")))

        assert source.should_consume(self._state_with_prior(prior)) is True

    def test_true_when_different_check_suite_id(self) -> None:
        source = _check_suite_source(self._event(suite_id=1))
        prior = Feedback(source=_check_suite_source(self._event(suite_id=99)))

        assert source.should_consume(self._state_with_prior(prior)) is True

    def test_legacy_missing_updated_at_dedupes_by_suite_id(self) -> None:
        """History without updated_at falls back to suite-id-only dedupe."""
        legacy_event = self._event(updated_at=None)
        prior = Feedback(source=_check_suite_source(legacy_event))
        state = self._state_with_prior(prior)

        assert _check_suite_source(legacy_event).should_consume(state) is False
        # Re-run with updated_at is a distinct attempt key from suite-id-only legacy.
        assert (
            _check_suite_source(self._event(updated_at="2024-01-02T00:00:00Z")).should_consume(
                state
            )
            is True
        )


class CheckSuiteShouldTriggerTest(TestCase):
    def _source(self, head_sha="abc", *, repo: MagicMock | None = None) -> CheckSuiteFeedbackSource:
        return _check_suite_source(
            {
                "check_suite": {
                    "id": 1,
                    "head_sha": head_sha,
                    "check_runs_url": "https://github.com/owner/repo/check-runs",
                    "app": {"name": "CI"},
                },
                "repository": {"html_url": "https://github.com/owner/repo"},
            },
            autofix_run=_autofix_run(repo=repo),
        )

    def test_now_when_no_head_sha(self) -> None:
        assert self._source(head_sha="").should_trigger(_run_state()) == ConsumeTask.Now

    @patch("sentry.scm.factory.new", side_effect=Exception("boom"))
    def test_now_when_scm_init_fails(self, _mock_new: MagicMock) -> None:
        assert self._source().should_trigger(_run_state()) == ConsumeTask.Now

    @patch(f"{CHECK_SUITE_SOURCE_PATH}.ListCheckRunsForRefProtocol", type("Other", (), {}))
    @patch("sentry.scm.factory.new")
    def test_now_when_unsupported_provider(self, mock_new: MagicMock) -> None:
        mock_new.return_value = MagicMock()

        assert self._source().should_trigger(_run_state()) == ConsumeTask.Now

    @patch(f"{CHECK_SUITE_SOURCE_PATH}.iter_all_pages")
    @patch(f"{CHECK_SUITE_SOURCE_PATH}.ListCheckRunsForRefProtocol", object)
    @patch("sentry.scm.factory.new")
    def test_later_when_a_check_suite_not_completed(
        self,
        mock_new: MagicMock,
        mock_pages: MagicMock,
    ) -> None:
        mock_new.return_value = MagicMock()
        mock_pages.return_value = [{"data": [{"status": "in_progress"}]}]

        assert self._source().should_trigger(_run_state()) == ConsumeTask.Later(timedelta(hours=1))

    @patch(f"{CHECK_SUITE_SOURCE_PATH}.iter_all_pages")
    @patch(f"{CHECK_SUITE_SOURCE_PATH}.ListCheckRunsForRefProtocol", object)
    @patch("sentry.scm.factory.new")
    def test_now_when_all_completed(
        self,
        mock_new: MagicMock,
        mock_pages: MagicMock,
    ) -> None:
        mock_new.return_value = MagicMock()
        mock_pages.return_value = [{"data": [{"status": "completed"}]}]

        assert self._source().should_trigger(_run_state()) == ConsumeTask.Now

    @patch(f"{CHECK_SUITE_SOURCE_PATH}.iter_all_pages", side_effect=Exception("boom"))
    @patch(f"{CHECK_SUITE_SOURCE_PATH}.ListCheckRunsForRefProtocol", object)
    @patch("sentry.scm.factory.new")
    def test_now_when_list_check_suites_fails(
        self,
        mock_new: MagicMock,
        _mock_pages: MagicMock,
    ) -> None:
        mock_new.return_value = MagicMock()

        assert self._source().should_trigger(_run_state()) == ConsumeTask.Now


class ResolveCheckSuiteRepositoriesTest(TestCase):
    def test_empty_when_missing_ids(self) -> None:
        assert (
            resolve_check_suite_repositories(GithubCheckSuiteEvent.parse_obj(_check_suite_event()))
            == []
        )
        assert (
            resolve_check_suite_repositories(
                GithubCheckSuiteEvent.parse_obj({**_check_suite_event(), "installation": {"id": 1}})
            )
            == []
        )

    @patch(f"{CHECK_SUITE_SOURCE_PATH}.integration_service.organization_contexts")
    def test_empty_when_no_integration(self, mock_contexts: MagicMock) -> None:
        mock_contexts.return_value = MagicMock(integration=None, organization_integrations=[])

        result = resolve_check_suite_repositories(
            GithubCheckSuiteEvent.parse_obj(
                {
                    **_check_suite_event(),
                    "installation": {"id": 1},
                    "repository": {"id": 2, "html_url": "https://github.com/owner/repo"},
                }
            )
        )

        assert result == []

    @patch(f"{CHECK_SUITE_SOURCE_PATH}.integration_service.organization_contexts")
    def test_returns_matching_repos(self, mock_contexts: MagicMock) -> None:
        repo = self.create_repo(
            project=self.project,
            provider="integrations:github",
            external_id="2",
            name="owner/repo",
        )
        mock_contexts.return_value = MagicMock(
            integration=MagicMock(),
            organization_integrations=[MagicMock(organization_id=self.organization.id)],
        )

        result = resolve_check_suite_repositories(
            GithubCheckSuiteEvent.parse_obj(
                {
                    **_check_suite_event(),
                    "installation": {"id": 1},
                    "repository": {"id": 2, "html_url": "https://github.com/owner/repo"},
                }
            )
        )

        assert [r.id for r in result] == [repo.id]

    @patch(f"{CHECK_SUITE_SOURCE_PATH}.integration_service.organization_contexts")
    def test_returns_all_matching_repos_across_orgs(self, mock_contexts: MagicMock) -> None:
        other_org = self.create_organization()
        other_project = self.create_project(organization=other_org)
        repo_a = self.create_repo(
            project=self.project,
            provider="integrations:github",
            external_id="2",
            name="owner/repo",
        )
        repo_b = self.create_repo(
            project=other_project,
            provider="integrations:github",
            external_id="2",
            name="owner/repo",
        )
        mock_contexts.return_value = MagicMock(
            integration=MagicMock(),
            organization_integrations=[
                MagicMock(organization_id=self.organization.id),
                MagicMock(organization_id=other_org.id),
            ],
        )

        result = resolve_check_suite_repositories(
            GithubCheckSuiteEvent.parse_obj(
                {
                    **_check_suite_event(),
                    "installation": {"id": 1},
                    "repository": {"id": 2, "html_url": "https://github.com/owner/repo"},
                }
            )
        )

        assert {repo.id for repo in result} == {repo_a.id, repo_b.id}
