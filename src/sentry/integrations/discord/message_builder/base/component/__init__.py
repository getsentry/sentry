from .action_row import DiscordActionRow  # noqa: F401,F403
from .base import *  # noqa: F401,F403
from .button import *  # noqa: F401,F403


class DiscordComponentCustomIds:
    """
    Constant to track these ids across modules

    A custom_id must have ':{group_id}' appended to it, so we can track the
    group across interactions. This may need to be changed once we extend to
    other notification types.
    """

    ARCHIVE = "archive"
    ASSIGN_DIALOG = "assign_dialog"
    RESOLVE_DIALOG = "resolve_dialog"
    ASSIGN = "assign"
    RESOLVE = "resolve"
    UNRESOLVE = "unresolve"
    MARK_ONGOING = "mark_ongoing"
