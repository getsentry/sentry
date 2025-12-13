from dataclasses import dataclass

from sentry.notifications.platform.registry import template_registry
from sentry.notifications.platform.types import (
    NotificationCategory,
    NotificationData,
    NotificationRenderedTemplate,
    NotificationTemplate,
)

# TODO(leander): We're going to shortcut this with a custom renderer, since not all the
# required SlackBlocks are available in the NotificationRenderedTemplate.


@dataclass
class SeerPartialAutofixTriggers(NotificationData):
    source: str = "seer-partial-autofix-triggers"
    label: str = "Start RCA"


@template_registry.register(SeerPartialAutofixTriggers.source)
class SeerPartialAutofixTriggersTemplate(NotificationTemplate[SeerPartialAutofixTriggers]):
    category = NotificationCategory.SEER
    example_data = SeerPartialAutofixTriggers(source="seer-partial-autofix-triggers")
    hide_from_debugger = True

    def render(self, data: SeerPartialAutofixTriggers) -> NotificationRenderedTemplate:
        return NotificationRenderedTemplate(subject="Seer Partial Autofix Triggers", body=[])


@dataclass
class SeerContextInput(NotificationData):
    source: str = "seer-context-input"
    label: str = "Share helpful context with Seer"
    placeholder: str = "There might be a file..."


@template_registry.register(SeerContextInput.source)
class SeerContextInputTemplate(NotificationTemplate[SeerContextInput]):
    category = NotificationCategory.SEER
    example_data = SeerContextInput(
        source="seer-context-input", placeholder="There might be a file..."
    )
    hide_from_debugger = True

    def render(self, data: SeerContextInput) -> NotificationRenderedTemplate:
        return NotificationRenderedTemplate(subject="Seer Context Input", body=[])


@dataclass
class SeerContextInputComplete(NotificationData):
    provided_context: str
    source: str = "seer-context-input-complete"


@template_registry.register(SeerContextInputComplete.source)
class SeerContextInputCompleteTemplate(NotificationTemplate[SeerContextInputComplete]):
    category = NotificationCategory.SEER
    example_data = SeerContextInputComplete(
        source="seer-context-input-complete",
        provided_context="i think there might be a file called `post_process.py` which is usually related to these ingest timeout issues. give that a shot...",
    )
    hide_from_debugger = True

    def render(self, data: SeerContextInputComplete) -> NotificationRenderedTemplate:
        return NotificationRenderedTemplate(subject="Seer Context Input Complete", body=[])
