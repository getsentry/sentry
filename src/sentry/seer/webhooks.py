import re
from dataclasses import dataclass

MARKER = "@sentry"
REVIEW_COMMAND = f"{MARKER} review"

# Shared patterns for bounded @sentry mentions (whitespace or string edges only).
MARKER_PATTERN = re.compile(r"(?:^|\s)@sentry(?=\s|$)", re.IGNORECASE)
REVIEW_PATTERN = re.compile(r"(?:^|\s)@sentry review(?=\s|$)", re.IGNORECASE)


class SentryCommand: ...


class SentryReviewCommand(SentryCommand): ...


@dataclass
class SentryIterateCommand(SentryCommand):
    feedback: str


def _remove_bounded_sentry_mentions(comment_body: str) -> str:
    def replacer(match: re.Match[str]) -> str:
        # Preserve whitespace that preceded the mention so surrounding words stay separated.
        return " " if match.group(0)[0].isspace() else ""

    return MARKER_PATTERN.sub(replacer, comment_body)


def sentry_command(comment_body: str | None) -> SentryCommand | None:
    if comment_body is None:
        return None

    if not MARKER_PATTERN.search(comment_body):
        return None

    if REVIEW_PATTERN.search(comment_body):
        return SentryReviewCommand()

    feedback = " ".join(_remove_bounded_sentry_mentions(comment_body).split())
    if not feedback:
        return None

    return SentryIterateCommand(feedback=feedback)
