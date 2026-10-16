import abc
from typing import Generic, TypeVar

from sentry.workflow_engine.handlers.detector.base import BaseDetectorHandler
from sentry.workflow_engine.models import DataPacket
from sentry.workflow_engine.types import DetectorSettings

AnalysisInputType = TypeVar("AnalysisInputType")
AnalysisResultType = TypeVar("AnalysisResultType")


class LLMDetectorSettings(DetectorSettings):
    """LLM parameters for an independently executed detector."""

    config_schema = {
        "type": "object",
        "properties": {
            "prompt_key": {"type": "string", "minLength": 1},
            "model": {"type": "string", "minLength": 1},
            "temperature": {"type": "number", "minimum": 0},
        },
        "required": ["prompt_key", "model"],
        "additionalProperties": False,
    }


class LLMDetectorHandler(
    BaseDetectorHandler[AnalysisResultType, AnalysisResultType],
    Generic[AnalysisInputType, AnalysisResultType],
):
    """Analyze supplied input as one independent, asynchronous detector run.

    Scheduling and input selection belong to the caller. Each call to ``dispatch``
    submits one run to Seer using the detector's LLM parameters. Implementations
    carry detector identity and a stable run identity through submission and
    completion, and define retry-safe occurrence identities.

    The callback reloads the detector, checks its current state and project
    attribution, and passes the completed result to ``process_detectors``. That
    constructs a new handler and invokes ``evaluate`` through the shared metrics
    wrapper. Runs cannot rely on state held by the dispatching handler instance.

    Subclasses implement ``dispatch`` and ``evaluate`` without a condition group.
    Submission is not a completed evaluation. Detector processing records completed
    evaluations and publishes their results through ``on_complete``; that hook is
    not the remote callback endpoint.
    """

    @abc.abstractmethod
    def dispatch(self, data_packet: DataPacket[AnalysisInputType]) -> None:
        """Submit one run for supplied input; raise if submission fails.

        The caller must load an eligible, enabled detector before dispatching.
        Only completed result packets may be passed to detector processing.
        """
        raise NotImplementedError
