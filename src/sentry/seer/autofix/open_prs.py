from __future__ import annotations

from collections.abc import Callable
from typing import Any

from sentry.seer.autofix.constants import AutofixAutomationTuningSettings
from sentry.seer.autofix.utils import AutofixStoppingPoint


def get_open_prs(get_option: Callable[[str], Any]) -> bool:
    stored = get_option("sentry:seer_open_prs")
    if stored is not None:
        return bool(stored)
    return (
        get_option("sentry:autofix_automation_tuning") != AutofixAutomationTuningSettings.OFF
        and get_option("sentry:seer_automated_run_stopping_point") == AutofixStoppingPoint.OPEN_PR
    )
