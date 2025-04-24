from dataclasses import dataclass
from enum import Enum
from typing import Any, Protocol

from sentry.replays.tasks import ai_analyze_replay
from sentry.replays.usecases.events import ai_score_event, ai_summary_event

# AI request initiators.


class TaskProtocol(Protocol):
    analysis_type: int
    countdown: int
    project_id: int
    replay_id: str
    segment_id: int
    segment_range: tuple[int, int]
    timestamp: float

    def delay(self) -> None: ...


class AnalysisType(Enum):
    SUMMARIZE = 0
    ERROR_IMPACT = 1
    SPINNER_IMPACT = 2


@dataclass(frozen=True)
class Task:
    project_id: int
    replay_id: str
    segment_id: int
    timestamp: float

    def delay(self) -> None:
        return request_analysis_task(self)


@dataclass(frozen=True)
class ErrorImpactAnalysis(Task):
    analysis_type = AnalysisType.ERROR_IMPACT.value
    countdown = 60

    @property
    def segment_range(self) -> tuple[int, int]:
        return (max(self.segment_id - 5, 0), min(self.segment_id + 5, 1000))


@dataclass(frozen=True)
class SpinnerImpactAnalysis(Task):
    analysis_type = AnalysisType.SPINNER_IMPACT.value
    countdown = 0

    @property
    def segment_range(self) -> tuple[int, int]:
        return (self.segment_id, self.segment_id)


@dataclass(frozen=True)
class SummaryTask(Task):
    analysis_type = AnalysisType.SUMMARIZE.value
    countdown = 3600
    segment_range = (0, 1000)


def request_analysis_task(task: TaskProtocol) -> None:
    ai_analyze_replay.apply_async(
        (
            task.analysis_type,
            task.project_id,
            task.timestamp,
            task.replay_id,
            task.segment_range[0],
            task.segment_range[1],
        ),
        countdown=task.countdown,
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
