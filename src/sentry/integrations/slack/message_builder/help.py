from typing import Optional

from sentry.integrations.slack.message_builder import SlackBody
from sentry.integrations.slack.message_builder.base.base import SlackMessageBuilder

AVAILABLE_COMMANDS = {
    "help": "displays the available commands",
    "link": "kicks of linking Slack and Sentry",
    "unlink": "unlinks your identity",
}


def get_message(command: Optional[str] = None) -> str:
    unknown_command = f"Unknown command: `{command}`\n" if command else ""
    commands_list = "\n".join(
        f"• *{command}* - {description}" for command, description in AVAILABLE_COMMANDS.items()
    )
    return f"{unknown_command}Available Commands:\n{commands_list}"


class SlackHelpMessageBuilder(SlackMessageBuilder):
    def __init__(self, command: Optional[str] = None) -> None:
        super().__init__()
        self.command = command

    def build(self) -> SlackBody:
        return self._build(
            text=get_message(self.command),
        )
