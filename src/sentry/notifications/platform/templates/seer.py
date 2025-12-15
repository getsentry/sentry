from dataclasses import dataclass

from sentry.notifications.platform.registry import template_registry
from sentry.notifications.platform.types import (
    CodeTextBlock,
    NotificationCategory,
    NotificationData,
    NotificationRenderedTemplate,
    NotificationTemplate,
    ParagraphBlock,
)

# TODO(leander): We're going to shortcut this with a custom renderer, since not all the
# required SlackBlocks are available in the NotificationRenderedTemplate.


@dataclass
class SeerAutofixTrigger(NotificationData):
    source: str = "seer-autofix-trigger"
    label: str = "Start RCA"


@template_registry.register(SeerAutofixTrigger.source)
class SeerAutofixTriggerTemplate(NotificationTemplate[SeerAutofixTrigger]):
    category = NotificationCategory.SEER
    example_data = SeerAutofixTrigger(source="seer-autofix-trigger")
    hide_from_debugger = True

    def render(self, data: SeerAutofixTrigger) -> NotificationRenderedTemplate:
        return NotificationRenderedTemplate(subject="Seer Autofix Trigger", body=[])


@dataclass
class SeerAutofixError(NotificationData):
    error_message: str
    source: str = "seer-autofix-error"
    error_title: str = "Seer had some trouble..."


@template_registry.register(SeerAutofixError.source)
class SeerAutofixErrorTemplate(NotificationTemplate[SeerAutofixError]):
    category = NotificationCategory.SEER
    example_data = SeerAutofixError(
        source="seer-autofix-error",
        error_message="(401): Could not connect to your GitHub repository for this project.",
    )

    def render(self, data: SeerAutofixError) -> NotificationRenderedTemplate:
        return NotificationRenderedTemplate(
            subject=data.error_title,
            body=[
                ParagraphBlock(blocks=[CodeTextBlock(text=data.error_message)]),
            ],
        )


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
