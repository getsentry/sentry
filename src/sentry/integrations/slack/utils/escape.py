from __future__ import annotations

import re

# TODO(scttcper): Might need to handle "*" bold, and "_" italics
translator = str.maketrans({"&": "&amp;", "<": "&lt;", ">": "&gt;"})


def escape_slack_text(txt: str | None) -> str:
    """
    When using user input inside slack links or slack "mrkdwn" special characters
    could break formatting.

    docs - https://api.slack.com/reference/surfaces/formatting#escaping
    """
    if not txt:
        return ""
    return txt.translate(translator)


def escape_slack_markdown_text(txt: str | None) -> str:
    """
    Reduces runs of multiple backticks to a single backtick.
    This prevents the "mrkdwn" code block from ending early and leaving the rest of the text out of the code block.
    """
    if not txt:
        return ""

    backtick_pattern = re.compile(r"`+")

    return backtick_pattern.sub("`", txt)
