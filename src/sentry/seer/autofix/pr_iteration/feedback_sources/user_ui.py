from typing import Any, Literal

from sentry.seer.autofix.pr_iteration.feedback_sources.base import FeedbackSourceBase


class UserUIFeedbackSource(FeedbackSourceBase):
    type: Literal["user-ui"] = "user-ui"
    user_id: int
    user: Any = None
    # The feedback the user typed in the UI. Optional so feedback serialized
    # before this field existed still parses (see Feedback._populate).
    user_feedback: str = ""

    @property
    def text(self) -> str:
        return self.user_feedback
