from __future__ import annotations

import re

# TODO(scttcper): Might need to handle "*" bold, and "_" italics
translator = str.maketrans({"&": "&amp;", "<": "&lt;", ">": "&gt;"})

# Slack only parses the `<url|label>` link syntax when the label is on a
# single line; a newline in the label renders the whole thing as literal
# mrkdwn text (nothing in the message is clickable).
newline_pattern = re.compile(r"\s*[\r\n]+\s*")


def escape_slack_text(txt: str | None) -> str:
    """
    When using user input inside slack links or slack "mrkdwn" special characters
    could break formatting.

    docs - https://api.slack.com/reference/surfaces/formatting#escaping
    """
    if not txt:
        return ""
    return txt.translate(translator)


def escape_slack_link_label(txt: str | None) -> str:
    """
    Escape text used as the label of a `<url|label>` link.

    Applies `escape_slack_text` and collapses newlines into spaces: Slack only
    parses the link syntax when the label sits on a single line. Inline mrkdwn
    formatting (e.g. `*bold*`) inside a label is also unreliable on mobile
    clients, so callers should not add formatting around the result.
    """
    escaped = escape_slack_text(txt)
    return newline_pattern.sub(" ", escaped)


def escape_slack_markdown_text(txt: str | None) -> str:
    """
    Reduces runs of multiple backticks to a single backtick.
    This prevents the "mrkdwn" code block from ending early and leaving the rest of the text out of the code block.
    """
    if not txt:
        return ""

    backtick_pattern = re.compile(r"`+")

    return backtick_pattern.sub("`", txt)
