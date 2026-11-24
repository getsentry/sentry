from __future__ import annotations

from typing import Any

from sentry.models.project import Project
from sentry.seer.autofix.constants import AutofixAutomationTuningSettings
from sentry.seer.autofix.utils import AutofixStoppingPoint

OPEN_PRS_OPTION = "sentry:seer_open_prs"


def resolve_open_prs(stored: Any, automation_tuning: str, stopping_point: str) -> bool:
    # A project that never set Open PRs follows its Automation Steps dropdown.
    if stored is not None:
        return bool(stored)
    return (
        automation_tuning != AutofixAutomationTuningSettings.OFF
        and stopping_point == AutofixStoppingPoint.OPEN_PR
    )


def get_open_prs_setting(project: Project) -> bool:
    return resolve_open_prs(
        project.get_option(OPEN_PRS_OPTION),
        project.get_option("sentry:autofix_automation_tuning"),
        project.get_option("sentry:seer_automated_run_stopping_point"),
    )
