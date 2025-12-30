from dataclasses import dataclass

from sentry.notifications.platform.registry import template_registry
from sentry.notifications.platform.templates.types import NotificationTemplateSource
from sentry.notifications.platform.types import (
    NotificationCategory,
    NotificationData,
    NotificationRenderedTemplate,
    NotificationTemplate,
    ParagraphBlock,
    PlainTextBlock,
)


@dataclass(frozen=True)
class SeerAutofixTrigger(NotificationData):
    source: NotificationTemplateSource = NotificationTemplateSource.SEER_AUTOFIX_TRIGGER
    label: str = "Start RCA"


@template_registry.register(SeerAutofixTrigger.source)
class SeerAutofixTriggerTemplate(NotificationTemplate[SeerAutofixTrigger]):
    category = NotificationCategory.SEER
    example_data = SeerAutofixTrigger(source=NotificationTemplateSource.SEER_AUTOFIX_TRIGGER)
    hide_from_debugger = True

    def render(self, data: SeerAutofixTrigger) -> NotificationRenderedTemplate:
        return NotificationRenderedTemplate(subject="Seer Autofix Trigger", body=[])


@dataclass(frozen=True)
class SeerAutofixError(NotificationData):
    error_message: str
    source: NotificationTemplateSource = NotificationTemplateSource.SEER_AUTOFIX_ERROR
    error_title: str = "Seer had some trouble..."


@template_registry.register(SeerAutofixError.source)
class SeerAutofixErrorTemplate(NotificationTemplate[SeerAutofixError]):
    category = NotificationCategory.SEER
    example_data = SeerAutofixError(
        source=NotificationTemplateSource.SEER_AUTOFIX_ERROR,
        error_message="(401): Could not connect to your GitHub repository for this project.",
    )

    def render(self, data: SeerAutofixError) -> NotificationRenderedTemplate:
        return NotificationRenderedTemplate(
            subject=data.error_title,
            body=[ParagraphBlock(blocks=[PlainTextBlock(text=data.error_message)])],
        )


@dataclass(frozen=True)
class SeerContextInput(NotificationData):
    run_id: int
    organization_id: int
    source: NotificationTemplateSource = NotificationTemplateSource.SEER_CONTEXT_INPUT
    label: str = "Share helpful context with Seer"
    placeholder: str = "There might be a file..."


@template_registry.register(SeerContextInput.source)
class SeerContextInputTemplate(NotificationTemplate[SeerContextInput]):
    category = NotificationCategory.SEER
    example_data = SeerContextInput(
        source=NotificationTemplateSource.SEER_CONTEXT_INPUT,
        run_id=12152025,
        organization_id=1,
        placeholder="There might be a file...",
    )
    hide_from_debugger = True

    def render(self, data: SeerContextInput) -> NotificationRenderedTemplate:
        return NotificationRenderedTemplate(subject="Seer Context Input", body=[])


@dataclass(frozen=True)
class SeerContextInputComplete(NotificationData):
    provided_context: str
    source: NotificationTemplateSource = NotificationTemplateSource.SEER_CONTEXT_INPUT_COMPLETE


@template_registry.register(SeerContextInputComplete.source)
class SeerContextInputCompleteTemplate(NotificationTemplate[SeerContextInputComplete]):
    category = NotificationCategory.SEER
    example_data = SeerContextInputComplete(
        source=NotificationTemplateSource.SEER_CONTEXT_INPUT_COMPLETE,
        provided_context="i think there might be a file called `post_process.py` which is usually related to these ingest timeout issues. give that a shot...",
    )
    hide_from_debugger = True

    def render(self, data: SeerContextInputComplete) -> NotificationRenderedTemplate:
        return NotificationRenderedTemplate(subject="Seer Context Input Complete", body=[])
