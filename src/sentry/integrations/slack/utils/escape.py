# TODO(scttcper): Might need to handle "*" bold, and "_" italics
translator = str.maketrans({"&": "&amp;", "<": "&lt;", ">": "&gt;"})


def escape_slack_text(txt: str) -> str:
    """
    When using user input inside slack links or slack "mrkdwn" special characters
    could break formatting.

    docs - https://api.slack.com/reference/surfaces/formatting#escaping
    """
    return txt.translate(translator)
