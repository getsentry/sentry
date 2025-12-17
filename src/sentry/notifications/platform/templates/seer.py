from dataclasses import dataclass

from sentry.notifications.platform.registry import template_registry
from sentry.notifications.platform.types import (
    NotificationCategory,
    NotificationData,
    NotificationRenderedTemplate,
    NotificationTemplate,
    ParagraphBlock,
    PlainTextBlock,
)
from sentry.seer.autofix.utils import AutofixStoppingPoint


@dataclass(frozen=True)
class SeerAutofixTrigger(NotificationData):
    organization_id: int
    project_id: int | None = None
    source: str = "seer-autofix-trigger"
    stopping_point: AutofixStoppingPoint = AutofixStoppingPoint.ROOT_CAUSE

    @property
    def label(self) -> str:
        if self.stopping_point == AutofixStoppingPoint.ROOT_CAUSE:
            return "Start RCA"
        elif self.stopping_point == AutofixStoppingPoint.SOLUTION:
            return "Plan a Solution"
        elif self.stopping_point == AutofixStoppingPoint.CODE_CHANGES:
            return "Write Code Changes"
        elif self.stopping_point == AutofixStoppingPoint.OPEN_PR:
            return "Draft a PR"


@template_registry.register(SeerAutofixTrigger.source)
class SeerAutofixTriggerTemplate(NotificationTemplate[SeerAutofixTrigger]):
    category = NotificationCategory.SEER
    example_data = SeerAutofixTrigger(
        source="seer-autofix-trigger",
        project_id=1,
        organization_id=1,
        stopping_point=AutofixStoppingPoint.ROOT_CAUSE,
    )
    hide_from_debugger = True

    def render(self, data: SeerAutofixTrigger) -> NotificationRenderedTemplate:
        return NotificationRenderedTemplate(subject="Seer Autofix Trigger", body=[])


@dataclass(frozen=True)
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
            body=[ParagraphBlock(blocks=[PlainTextBlock(text=data.error_message)])],
        )


@dataclass(frozen=True)
class SeerAutofixSuccess(NotificationData):
    run_id: int
    organization_id: int
    stopping_point: AutofixStoppingPoint
    source: str = "seer-autofix-success"


@template_registry.register(SeerAutofixSuccess.source)
class SeerAutofixSuccessTemplate(NotificationTemplate[SeerAutofixSuccess]):
    category = NotificationCategory.SEER
    example_data = SeerAutofixSuccess(
        source="seer-autofix-success",
        run_id=12152025,
        organization_id=1,
        stopping_point=AutofixStoppingPoint.ROOT_CAUSE,
    )
    hide_from_debugger = True

    def render(self, data: SeerAutofixSuccess) -> NotificationRenderedTemplate:
        return NotificationRenderedTemplate(subject="Seer Autofix Success", body=[])


@dataclass(frozen=True)
class SeerAutofixUpdate(NotificationData):
    run_id: int
    organization_id: int
    current_point: AutofixStoppingPoint
    summary: str
    steps: list[str]
    group_link: str
    source: str = "seer-autofix-update"


@template_registry.register(SeerAutofixUpdate.source)
class SeerAutofixUpdateTemplate(NotificationTemplate[SeerAutofixUpdate]):
    category = NotificationCategory.SEER
    example_data = SeerAutofixUpdate(
        source="seer-autofix-update",
        run_id=12152025,
        current_point=AutofixStoppingPoint.ROOT_CAUSE,
        organization_id=1,
        summary="Undefined variable `name06` in `error_function` causes an unhandled `NameError` during test transaction execution.",
        steps=[
            "Flask application starts, initializing Sentry SDK for error capture.",
            "User triggers the error route, starting the test transaction context.",
            "The application calls the error function, which contains the bug.",
            "Attempting to print an undefined variable raises an unhandled NameError.",
        ],
        group_link="https://sentry.sentry.io/issues/123456/",
    )
    hide_from_debugger = True

    def render(self, data: SeerAutofixUpdate) -> NotificationRenderedTemplate:
        return NotificationRenderedTemplate(subject="Seer Autofix Update", body=[])
