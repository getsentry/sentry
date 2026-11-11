from __future__ import annotations

from typing import TYPE_CHECKING, Any, TypedDict

from sentry.seer.autofix.feature.models import SINGLE_RUN_FEATURE_ID

if TYPE_CHECKING:
    from sentry.seer.agent.client_models import SeerRunState
    from sentry.seer.models.run import SeerRun

SINGLE_RUN_ROOT_CAUSE_KEY = "single_run_root_cause"
SINGLE_RUN_STOP_KEY = "stop"


def is_single_run(state: SeerRunState) -> bool:
    return (state.metadata or {}).get("feature_id") == SINGLE_RUN_FEATURE_ID


def is_single_run_record(run: SeerRun) -> bool:
    from sentry.seer.models.run import SeerAgentRun

    return SeerAgentRun.objects.filter(run=run, source=SINGLE_RUN_FEATURE_ID).exists()


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


def rename_single_run_root_cause(artifacts: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [
        {**artifact, "key": "root_cause"}
        if artifact["key"] == SINGLE_RUN_ROOT_CAUSE_KEY
        else artifact
        for artifact in artifacts
    ]


class SingleRunStop(TypedDict):
    reason: str
    suggestion: str


def single_run_stop_payload(state: SeerRunState) -> SingleRunStop | None:
    artifact = state.get_artifacts().get(SINGLE_RUN_STOP_KEY)
    data = artifact.data if artifact else None
    if not data or not data.get("reason") or not data.get("suggestion"):
        return None
    return {"reason": data["reason"], "suggestion": data["suggestion"]}
