from __future__ import annotations

from dataclasses import dataclass, field
from typing import TypedDict

from sentry.constants import ENABLE_SEER_CODING_DEFAULT
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
from sentry.organizations.services.organization.service import organization_service
from sentry.seer.autofix.issue_summary import STOPPING_POINT_HIERARCHY
from sentry.seer.autofix.utils import AutofixStoppingPoint

# Inverted hierarchy for looking up stopping point by rank
_RANK_TO_STOPPING_POINT = {rank: point for point, rank in STOPPING_POINT_HIERARCHY.items()}


def _get_next_stopping_point(current: AutofixStoppingPoint) -> AutofixStoppingPoint | None:
    """Get the next stopping point in the autofix progression sequence."""
    current_rank = STOPPING_POINT_HIERARCHY.get(current)
    if current_rank is None:
        return None
    return _RANK_TO_STOPPING_POINT.get(current_rank + 1)


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
    has_progressed: bool = False
    automation_stopping_point: AutofixStoppingPoint | None = None
    source: NotificationTemplateSource = NotificationTemplateSource.SEER_AUTOFIX_UPDATE

    @property
    def next_point(self) -> AutofixStoppingPoint | None:
        return _get_next_stopping_point(self.current_point)

    @property
    def has_next_trigger(self) -> bool:
        match self.current_point:
            case AutofixStoppingPoint.ROOT_CAUSE:
                return True
            case AutofixStoppingPoint.SOLUTION | AutofixStoppingPoint.CODE_CHANGES:
                has_coding_enabled = organization_service.get_option(
                    organization_id=self.organization_id,
                    key="sentry:enable_seer_coding",
                )
                if has_coding_enabled is None:
                    has_coding_enabled = ENABLE_SEER_CODING_DEFAULT
                return has_coding_enabled
            case AutofixStoppingPoint.OPEN_PR:
                return False


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


@dataclass(frozen=True)
class SeerAutofixTrigger(NotificationData):
    """
    Note: This data is only used to render the trigger itself for an autofix run,
    not the entire message it may be attached to. This was done for compatability with existing
    alert rendering, prior to being migrated to the Notification Platform.
    """

    organization_id: int
    project_id: int
    group_id: int
    run_id: int | None = None
    source: NotificationTemplateSource = NotificationTemplateSource.SEER_AUTOFIX_TRIGGER
    stopping_point: AutofixStoppingPoint = AutofixStoppingPoint.ROOT_CAUSE

    @staticmethod
    def from_update(update: SeerAutofixUpdate) -> SeerAutofixTrigger:
        """Get the next trigger after a given update."""
        stopping_point = _get_next_stopping_point(update.current_point)
        if stopping_point is None:
            raise ValueError(f"No next stopping point for {update.current_point}")
        return SeerAutofixTrigger(
            group_id=update.group_id,
            project_id=update.project_id,
            organization_id=update.organization_id,
            stopping_point=stopping_point,
        )
