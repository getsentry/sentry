from typing import Optional

from sentry.integrations.slack.message_builder import SlackBody
from sentry.integrations.slack.message_builder.base.base import SlackMessageBuilder

from .event import DM_COMMANDS_MESSAGE


def get_message(command: Optional[str] = None) -> str:
    unknown_command = f"Unknown command: `{command}`\n" if command else ""
    return f"{unknown_command}Available Commands:\n{DM_COMMANDS_MESSAGE}"


class SlackHelpMessageBuilder(SlackMessageBuilder):
    def __init__(self, command: Optional[str] = None) -> None:
        super().__init__()
        self.command = command

    def build(self) -> SlackBody:
        return self._build(
            text=get_message(self.command),
        )
