from enum import Enum
from typing import Any

from sentry.replays.tasks import ai_analyze_replay
from sentry.replays.usecases.events import ai_score_event, ai_summary_event

# AI request initiators.


class AnalysisType(Enum):
    SUMMARIZE = 0
    ERROR_IMPACT = 1
    SPINNER_IMPACT = 2


def request_impact_analysis_error(replay_id: str, segment_id: int) -> None:
    start_segment = max(segment_id - 5, 0)
    end_segment = min(segment_id + 5, 1000)

    ai_analyze_replay.apply_async(
        (AnalysisType.ERROR_IMPACT.value, replay_id, start_segment, end_segment),
        countdown=60,
    )


def request_impact_analysis_spinner(replay_id: str, segment_id: int) -> None:
    ai_analyze_replay.apply_async(
        (AnalysisType.SPINNER_IMPACT.value, replay_id, segment_id, segment_id)
    )


def request_replay_summary(
    project_id: int,
    timestamp: float,
    replay_id: str,
) -> None:
    ai_analyze_replay.apply_async(
        (AnalysisType.SUMMARIZE.value, project_id, timestamp, replay_id, 0, 1000),
        countdown=60 * 60,
    )


# AI response handlers.


def handle_response(
    analysis_type: int,
    project_id: int,
    timestamp: float,
    replay_id: str,
    response: dict[str, Any],
) -> None:
    match analysis_type:
        case AnalysisType.SUMMARIZE.value:
            summary = str(response["summary"])
            handle_replay_summary(project_id, timestamp, replay_id, summary)
        case AnalysisType.ERROR_IMPACT.value:
            score = int(response["score"])
            handle_impact_analysis_error(project_id, timestamp, replay_id, score)
        case AnalysisType.SPINNER_IMPACT.value:
            score = int(response["score"])
            handle_impact_analysis_spinner(project_id, timestamp, replay_id, score)
        case _:
            raise ValueError("Could not interpret analysis response type.")


def handle_impact_analysis_error(
    project_id: str,
    timestamp: float,
    replay_id: str,
    score: int,
) -> None:
    ai_score_event(project_id, replay_id, "error_impact", score, timestamp)


def handle_impact_analysis_spinner(
    project_id: str,
    timestamp: float,
    replay_id: str,
    score: int,
) -> None:
    ai_score_event(project_id, replay_id, "spinner_impact", score, timestamp)


def handle_replay_summary(
    project_id: str,
    timestamp: float,
    replay_id: str,
    summary: str,
):
    ai_summary_event(project_id, replay_id, summary, timestamp)
