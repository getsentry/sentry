from sentry.seer.autofix.pr_iteration.types import Feedback, format_feedback_for_prompt


def _review_feedback(
    text: str = "fix it",
    file_path: str | None = "src/sentry/foo.py",
    line: int | None = 42,
    start_line: int | None = None,
) -> Feedback:
    return Feedback(
        text=text,
        source={
            "type": "github-pr-review-comment",
            "comment": {"id": 1},
            "file_path": file_path,
            "line": line,
            "start_line": start_line,
        },
    )


def test_format_review_comment_range_anchor() -> None:
    feedback = _review_feedback(line=42, start_line=40)
    assert (
        format_feedback_for_prompt(feedback) == "Inline comment on src/sentry/foo.py:40-42:\nfix it"
    )


def test_format_review_comment_single_line_anchor() -> None:
    feedback = _review_feedback(line=42, start_line=None)
    assert format_feedback_for_prompt(feedback) == "Inline comment on src/sentry/foo.py:42:\nfix it"


def test_format_review_comment_collapsed_range_uses_single_line() -> None:
    # start_line == line: GitHub effectively treats this as single-line.
    feedback = _review_feedback(line=42, start_line=42)
    assert format_feedback_for_prompt(feedback) == "Inline comment on src/sentry/foo.py:42:\nfix it"


def test_format_review_comment_file_only_anchor() -> None:
    feedback = _review_feedback(line=None, start_line=None)
    assert format_feedback_for_prompt(feedback) == "Inline comment on src/sentry/foo.py:\nfix it"


def test_format_review_comment_no_file_path_passes_through() -> None:
    feedback = _review_feedback(file_path=None, line=None)
    assert format_feedback_for_prompt(feedback) == "fix it"


def test_format_top_level_comment_passes_through() -> None:
    feedback = Feedback(
        text="fix it",
        source={"type": "github-pr-comment", "comment": {"id": 1}},
    )
    assert format_feedback_for_prompt(feedback) == "fix it"


def test_format_ui_feedback_passes_through() -> None:
    feedback = Feedback(
        text="ui feedback",
        source={"type": "user-ui", "user_id": 1, "user": None},
    )
    assert format_feedback_for_prompt(feedback) == "ui feedback"
