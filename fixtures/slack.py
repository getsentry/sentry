MISSING_COMMAND = {
    "blocks": [
        {
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": "Here are the commands you can use. Commands not working? Re-install the app!",
            },
        },
        {"type": "section", "text": {"type": "mrkdwn", "text": "*Direct Message Commands:*"}},
        {
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": "`/sentry help`: View this list of commands.\n`/sentry link`: Link your Slack identity to your Sentry account to receive notifications. You'll also be able to perform actions in Sentry through Slack.\n`/sentry unlink`: Unlink your Slack identity from your Sentry account.",
            },
        },
        {"type": "section", "text": {"type": "mrkdwn", "text": "*Channel Commands:*"}},
        {
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": "`/sentry link team`: Get your Sentry team's issue alert notifications in the channel this command is typed in.\n`/sentry unlink team`: Unlink a team from the channel this command is typed in.",
            },
        },
        {"type": "section", "text": {"type": "mrkdwn", "text": "*Contact:*"}},
        {
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": "Let us know if you have feedback: ecosystem-feedback@sentry.io",
            },
        },
        {"type": "divider"},
        {
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": "Just want to learn more about Sentry? Check out our <https://docs.sentry.io/product/integrations/notification-incidents/slack/|documentation>.",
            },
        },
    ]
}

INVALID_COMMAND = {
    "blocks": [
        {
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": "Unknown command: `invalid command`",
            },
        },
        {
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": "Here are the commands you can use. Commands not working? Re-install the app!",
            },
        },
        {
            "type": "section",
            "text": {"type": "mrkdwn", "text": "*Direct Message Commands:*"},
        },
        {
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": "`/sentry help`: View this list of commands.\n`/sentry link`: Link your Slack identity to your Sentry account to receive notifications. You'll also be able to perform actions in Sentry through Slack.\n`/sentry unlink`: Unlink your Slack identity from your Sentry account.",
            },
        },
        {
            "type": "section",
            "text": {"type": "mrkdwn", "text": "*Channel Commands:*"},
        },
        {
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": "`/sentry link team`: Get your Sentry team's issue alert notifications in the channel this command is typed in.\n`/sentry unlink team`: Unlink a team from the channel this command is typed in.",
            },
        },
        {"type": "section", "text": {"type": "mrkdwn", "text": "*Contact:*"}},
        {
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": "Let us know if you have feedback: ecosystem-feedback@sentry.io",
            },
        },
        {"type": "divider"},
        {
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": "Just want to learn more about Sentry? Check out our <https://docs.sentry.io/product/integrations/notification-incidents/slack/|documentation>.",
            },
        },
    ]
}

HELP_COMMAND = {
    "blocks": [
        {
            "text": {
                "text": "Here are the commands you can use. Commands not "
                "working? Re-install the app!",
                "type": "mrkdwn",
            },
            "type": "section",
        },
        {
            "text": {"text": "*Direct Message Commands:*", "type": "mrkdwn"},
            "type": "section",
        },
        {
            "text": {
                "text": "`/sentry help`: View this list of commands.\n"
                "`/sentry link`: Link your Slack identity to "
                "your Sentry account to receive notifications. "
                "You'll also be able to perform actions in "
                "Sentry through Slack.\n"
                "`/sentry unlink`: Unlink your Slack identity "
                "from your Sentry account.",
                "type": "mrkdwn",
            },
            "type": "section",
        },
        {
            "text": {"text": "*Channel Commands:*", "type": "mrkdwn"},
            "type": "section",
        },
        {
            "text": {
                "text": "`/sentry link team`: Get your Sentry team's "
                "issue alert notifications in the channel this "
                "command is typed in.\n"
                "`/sentry unlink team`: Unlink a team from the "
                "channel this command is typed in.",
                "type": "mrkdwn",
            },
            "type": "section",
        },
        {"text": {"text": "*Contact:*", "type": "mrkdwn"}, "type": "section"},
        {
            "text": {
                "text": "Let us know if you have feedback: " "ecosystem-feedback@sentry.io",
                "type": "mrkdwn",
            },
            "type": "section",
        },
        {"type": "divider"},
        {
            "text": {
                "text": "Just want to learn more about Sentry? Check out "
                "our "
                "<https://docs.sentry.io/product/integrations/notification-incidents/slack/|documentation>.",
                "type": "mrkdwn",
            },
            "type": "section",
        },
    ]
}

SUPPORT_COMMAND = {
    "blocks": [
        {
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": "Need support? Check out these resources:",
            },
        },
        {
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": "• Want help for your particular case? <https://docs.sentry.io/support|File a ticket in Zendesk>. \n• Want to report an issue, request a feature, or get support? <https://github.com/getsentry/sentry/issues/new/choose|File a GitHub issue>. \n• Have feedback? Email ecosystem-feedback@sentry.io.",
            },
        },
    ]
}


DOCS_COMMAND = {
    "blocks": [
        {
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": "Want to view documentation? Check out these resources:",
            },
        },
        {
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": "• <https://docs.sentry.io/organization/integrations/|General Sentry integration docs> \n• <https://docs.sentry.io/organization/integrations/notification-incidents/slack/|Sentry Slack integration docs> \n• <https://sentry.slack.com/apps/A011MFBJEUU-sentry|Sentry Slack app>",
            },
        },
    ]
}
