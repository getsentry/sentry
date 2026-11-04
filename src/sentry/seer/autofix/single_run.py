from __future__ import annotations

from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from sentry.seer.agent.client_models import SeerRunState

SINGLE_RUN_ROOT_CAUSE_KEY = "single_run_root_cause"


def single_run_root_cause_payload(state: SeerRunState) -> dict[str, Any] | None:
    artifact = state.get_artifacts().get(SINGLE_RUN_ROOT_CAUSE_KEY)
    if artifact is None or not artifact.data:
        return None
    # Keeps the step-by-step root cause keys so webhook integrators don't break.
    # The slimmer payload ships later, with notice (AIML-3817).
    return {
        "headline": artifact.data.get("headline"),
        "one_line_description": artifact.data.get("cause"),
        "five_whys": [],
        "reproduction_steps": [],
    }
