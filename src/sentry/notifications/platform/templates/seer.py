from dataclasses import dataclass, field
from typing import TypedDict

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
from sentry.seer.autofix.utils import AutofixStoppingPoint


@dataclass(frozen=True)
class SeerAutofixTrigger(NotificationData):
    organization_id: int
    project_id: int
    group_id: int
    run_id: int | None = None
    source: NotificationTemplateSource = NotificationTemplateSource.SEER_AUTOFIX_TRIGGER
    stopping_point: AutofixStoppingPoint = AutofixStoppingPoint.ROOT_CAUSE

    @property
    def label(self) -> str:
        if self.stopping_point == AutofixStoppingPoint.ROOT_CAUSE:
            return "Fix with Seer"
        elif self.stopping_point == AutofixStoppingPoint.SOLUTION:
            return "Plan a Solution"
        elif self.stopping_point == AutofixStoppingPoint.CODE_CHANGES:
            return "Write Code Changes"
        elif self.stopping_point == AutofixStoppingPoint.OPEN_PR:
            return "Draft a PR"
        raise ValueError(f"Invalid stopping point, {self.stopping_point}")


@template_registry.register(SeerAutofixTrigger.source)
class SeerAutofixTriggerTemplate(NotificationTemplate[SeerAutofixTrigger]):
    category = NotificationCategory.SEER
    example_data = SeerAutofixTrigger(
        source=NotificationTemplateSource.SEER_AUTOFIX_TRIGGER,
        group_id=456,
        project_id=123,
        organization_id=1,
        stopping_point=AutofixStoppingPoint.ROOT_CAUSE,
    )
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
class SeerAutofixSuccess(NotificationData):
    run_id: int
    organization_id: int
    stopping_point: AutofixStoppingPoint
    source: NotificationTemplateSource = NotificationTemplateSource.SEER_AUTOFIX_SUCCESS


@template_registry.register(SeerAutofixSuccess.source)
class SeerAutofixSuccessTemplate(NotificationTemplate[SeerAutofixSuccess]):
    category = NotificationCategory.SEER
    example_data = SeerAutofixSuccess(
        source=NotificationTemplateSource.SEER_AUTOFIX_SUCCESS,
        run_id=12152025,
        organization_id=1,
        stopping_point=AutofixStoppingPoint.ROOT_CAUSE,
    )
    hide_from_debugger = True

    def render(self, data: SeerAutofixSuccess) -> NotificationRenderedTemplate:
        return NotificationRenderedTemplate(subject="Seer Autofix Success", body=[])


class SeerAutofixCodeChange(TypedDict):
    repo_name: str
    diff: str
    description: str
    title: str


class SeerAutofixPullRequest(TypedDict):
    pr_number: int
    pr_url: str


@dataclass(frozen=True)
class SeerAutofixUpdate(NotificationData):
    run_id: int
    organization_id: int
    project_id: int
    group_id: int
    current_point: AutofixStoppingPoint
    group_link: str
    steps: list[str] = field(default_factory=list)
    changes: list[SeerAutofixCodeChange] = field(default_factory=list)
    pull_requests: list[SeerAutofixPullRequest] = field(default_factory=list)
    summary: str | None = None
    source: NotificationTemplateSource = NotificationTemplateSource.SEER_AUTOFIX_UPDATE


@template_registry.register(SeerAutofixUpdate.source)
class SeerAutofixUpdateTemplate(NotificationTemplate[SeerAutofixUpdate]):
    category = NotificationCategory.SEER
    example_data = SeerAutofixUpdate(
        source=NotificationTemplateSource.SEER_AUTOFIX_UPDATE,
        run_id=12152025,
        project_id=123,
        group_id=456,
        current_point=AutofixStoppingPoint.ROOT_CAUSE,
        organization_id=1,
        summary="Undefined variable `name06` in `error_function` causes an unhandled `NameError` during test transaction execution.",
        steps=[
            "Flask application starts, initializing Sentry SDK for error capture.",
            "User triggers the error route, starting the test transaction context.",
            "The application calls the error function, which contains the bug.",
            "Attempting to print an undefined variable raises an unhandled NameError.",
        ],
        changes=[
            {
                "repo_name": "getsentry/sentry",
                "diff": "--- flask-error/src/runner.py\n+++ flask-error/src/runner.py\n@@ -1,2 +1,3 @@\n def error_function():\n+    name06 = 'demo variable'\n     print(name06)",
                "description": "- Added definition for local variable `name06` in `error_function`.",
                "title": "refactor: Define local variable name06 in runner.py",
            }
        ],
        pull_requests=[
            {
                "pr_number": 123,
                "pr_url": "https://github.com/getsentry/sentry/pull/123",
            }
        ],
        group_link="https://sentry.sentry.io/issues/123456/",
    )
    hide_from_debugger = True

    def render(self, data: SeerAutofixUpdate) -> NotificationRenderedTemplate:
        return NotificationRenderedTemplate(subject="Seer Autofix Update", body=[])
