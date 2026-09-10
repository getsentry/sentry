from __future__ import annotations

from typing import Any

from sentry import options
from sentry.seer.autofix.pr_iteration.feedback import Feedback
from sentry.seer.autofix.pr_iteration.feedback_sources.base import Decision
from sentry.seer.autofix.pr_iteration.logs import PrIterationLogContext
from sentry.utils import metrics

# Keep in sync with AUTOFIX_USER_CONTEXT_MAX_LENGTH in the frontend autofix types.
MANUAL_FEEDBACK_MAX_LENGTH = 3000


def _bot_feedback_allowlist() -> frozenset[str]:
    return frozenset(
        login.lower()
        for login in options.get("autofix.pr-iteration.bot-feedback-allowlist")
        if isinstance(login, str)
    )


def check_feedback_length(log_ctx: PrIterationLogContext, feedback: Feedback) -> Decision:
    """Decide whether one feedback item is too long.

    Returns ``ok=True`` with ``reason="not_capped"`` for a source the cap does not
    apply to, so the caller needs no special case.
    """
    source = feedback.source
    if not source.length_capped:
        return Decision(ok=True, reason="not_capped")

    # ui_text is the author-written text. text adds the diff anchor.
    length = len(feedback.ui_text)
    if length <= MANUAL_FEEDBACK_MAX_LENGTH:
        return Decision(ok=True, reason="within_limit")

    actor = "bot" if source.actor_is_bot else "human"
    login = source.actor_login
    if actor == "bot" and login is not None and login.lower() in _bot_feedback_allowlist():
        return Decision(ok=True, reason="bot_allowlisted")

    metrics.incr(
        "autofix.pr_iteration.feedback.over_length",
        tags={"source": source.type, "actor": actor},
    )
    fields: dict[str, Any] = {
        "feedback_source": source.type,
        "feedback_id": feedback.feedback_id,
        "feedback_length": length,
        "limit": MANUAL_FEEDBACK_MAX_LENGTH,
        "actor": actor,
    }
    if actor == "bot":
        fields["bot_login"] = login
    log_ctx.info("autofix.pr_iteration.feedback.over_length", **fields)
    return Decision(ok=False, reason=f"over_length_{actor}")
