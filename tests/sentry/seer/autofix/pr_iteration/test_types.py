from datetime import timedelta

import pytest
from pydantic import ValidationError

from sentry.seer.agent.client_models import MemoryBlock, Message, SeerRunState
from sentry.seer.autofix.pr_iteration.feedback import (
    Feedback,
    parse_feedback,
    serialize_feedback,
)
from sentry.seer.autofix.pr_iteration.feedback_sources.base import ConsumeTask
from sentry.seer.autofix.pr_iteration.feedback_sources.github_comment import (
    GithubIssueComment,
    GithubPrCommentFeedbackSource,
    GithubPrReviewCommentFeedbackSource,
)
from sentry.seer.autofix.pr_iteration.feedback_sources.user_ui import UserUIFeedbackSource
from sentry.testutils.cases import TestCase
from sentry.utils import json


def _run_state(*, blocks=None, repo_pr_states=None, status="completed") -> SeerRunState:
    return SeerRunState(
        run_id=1,
        blocks=blocks or [],
        status=status,
        updated_at="2024-01-01T00:00:00Z",
        repo_pr_states=repo_pr_states or {},
    )


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
) -> Feedback:
    return Feedback(
        source=GithubPrReviewCommentFeedbackSource(
            comment={
                "id": 1,
                "body": "@sentry fix it",
                "path": file_path,
                "line": line,
                "start_line": start_line,
            },
        ),
    )


class ParseSerializeFeedbackTest(TestCase):
    def test_round_trips_all_source_types(self) -> None:
        items = [
            Feedback(source=UserUIFeedbackSource(user_id=7, user_feedback="ui")),
            Feedback(
                source=GithubPrCommentFeedbackSource(comment={"id": 99, "body": "@sentry comment"})
            ),
        ]

        parsed = parse_feedback(serialize_feedback(items))

        # text is derived from each source: user-ui echoes the typed feedback,
        # pr-comment parses the comment body.
        assert parsed[0].text == "ui"
        assert parsed[1].text == "comment"
        assert isinstance(parsed[0].source, UserUIFeedbackSource)
        assert isinstance(parsed[1].source, GithubPrCommentFeedbackSource)
        assert parsed[0].source.user_id == 7
        assert parsed[1].source.comment.id == 99

    def test_parses_single_object(self) -> None:
        feedback = Feedback(source=UserUIFeedbackSource(user_id=1, user_feedback="solo"))

        parsed = parse_feedback(feedback.json())

        assert len(parsed) == 1
        assert parsed[0].text == "solo"

    def test_serializes_ui_text(self) -> None:
        items = [
            Feedback(source=UserUIFeedbackSource(user_id=7, user_feedback="ui")),
        ]

        serialized = serialize_feedback(items)

        parsed = parse_feedback(serialized)
        # user-ui has no distinct UI text, so it falls back to `text`.
        assert parsed[0].source.ui_text is None
        assert parsed[0].ui_text == "ui"

    def test_invalid_json_returns_empty(self) -> None:
        assert parse_feedback("not json") == []

    def test_schema_mismatch_returns_empty(self) -> None:
        assert parse_feedback('{"unexpected": true}') == []


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

    def test_text_no_file_path_passes_through(self) -> None:
        feedback = _review_feedback(file_path=None, line=None)
        assert feedback.text == "fix it"
        assert feedback.ui_text == "fix it"


class ConsumeTaskTest(TestCase):
    def test_now_returns_no_countdown(self) -> None:
        assert ConsumeTask.Now.countdown() is None

    def test_later_with_timedelta(self) -> None:
        task = ConsumeTask.Later(when=timedelta(seconds=30))
        assert task.countdown() == 30

    def test_later_with_negative_timedelta_returns_zero(self) -> None:
        task = ConsumeTask.Later(when=timedelta(seconds=-10))
        assert task.countdown() == 0
