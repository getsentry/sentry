HELP_BLOCKS = {
    "blocks": [
        {
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": (
                    ":bear: *Smokey is here to help you fight the fire!* :fire:\n\n"
                    "Here are the available commands you can use to manage incidents:"
                ),
            },
        },
        {"type": "divider"},
        {
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": (
                    "*From anywhere:*\n"
                    "*`/smokey new`* — Create a new incident, and channel to track it."
                ),
            },
        },
        {
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": (
                    "*From an incident channel:*\n"
                    "*`/smokey huddle`* — Start a huddle for the current incident.\n"
                    "*`/smokey update`* — Update the current incident.\n"
                    "*`/smokey close`* — Close the current incident.\n"
                    "*`/smokey reopen`* — Reopen a closed incident.\n"
                    "*`/smokey status new`* — Start a public incident on the status page.\n"
                    "*`/smokey status update`* — Update the existing incident on the status page."
                ),
            },
        },
        {"type": "divider"},
        {
            "type": "context",
            "elements": [
                {
                    "type": "mrkdwn",
                    "text": "Need more help? Call 911 (or 112 if you're in VIE)",
                }
            ],
        },
    ]
}
