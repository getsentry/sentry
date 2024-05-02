from dataclasses import dataclass

from sentry.notifications.utils.actions import BaseMessageAction


@dataclass
class BlockKitMessageAction(BaseMessageAction):
    label: str

    def _get_button_text(self) -> str:
        return self.label or self.name
