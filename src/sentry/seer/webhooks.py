import re
from dataclasses import dataclass

MARKER = "@sentry"
REVIEW_COMMAND = f"{MARKER} review"


class SentryCommand: ...


class SentryReviewCommand(SentryCommand): ...


@dataclass
class SentryIterateCommand(SentryCommand):
    feedback: str


def sentry_command(comment_body: str | None) -> SentryCommand | None:
    if comment_body is None:
        return None

    lowered = comment_body.lower()
    if REVIEW_COMMAND in lowered:
        return SentryReviewCommand()

    if MARKER not in lowered:
        return None

    removed_marker = re.split(re.escape(MARKER), comment_body, flags=re.IGNORECASE)
    stripped_parts = [part.strip() for part in removed_marker if part.strip()]
    joined = " ".join(stripped_parts)
    if not joined:
        return None

    return SentryIterateCommand(feedback=joined)
