# TODO(scttcper): Might need to add "*" bold, and "_" italics
ESCAPE_CHARS = [
    # Replace ampersand first to avoid adding more of them
    ("&", "&amp;"),
    ("<", "&lt;"),
    (">", "&gt;"),
]


def escape_slack_text(txt: str) -> str:
    """
    When using user input inside slack links or slack "mrkdwn" special characters
    could break formatting.
    """
    for character, replacement in ESCAPE_CHARS:
        txt = txt.replace(character, replacement)
    return txt
