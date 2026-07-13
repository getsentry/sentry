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

    # Check for @sentry with word boundaries to avoid matching @sentry-cursor-agent, etc.
    # Pattern explanation:
    # (?:^|\s) - either start of string or whitespace (non-capturing group)
    # @sentry - literal match
    # (?=\s|$) - followed by whitespace or end of string (positive lookahead, doesn't consume)
    marker_pattern = r"(?:^|\s)@sentry(?=\s|$)"

    if not re.search(marker_pattern, lowered):
        return None

    # Check for "review" command with the same boundary requirements
    review_pattern = r"(?:^|\s)@sentry\s+review"
    if re.search(review_pattern, lowered):
        return SentryReviewCommand()

    removed_marker = re.split(re.escape(MARKER), comment_body, flags=re.IGNORECASE)
    stripped_parts = [part.strip() for part in removed_marker if part.strip()]
    joined = " ".join(stripped_parts)
    if not joined:
        return None

    return SentryIterateCommand(feedback=joined)
