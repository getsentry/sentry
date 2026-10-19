import abc
from typing import Any, Generic, TypeVar

import orjson

from sentry.seer.models.seer_api_models import SeerApiError, SeerApiResponseValidationError
from sentry.seer.signed_seer_api import (
    LLMDetectorRequest,
    SeerViewerContext,
    make_llm_detector_request,
)
from sentry.workflow_engine.handlers.detector.base import DetectorHandler
from sentry.workflow_engine.models import DataPacket
from sentry.workflow_engine.types import DetectorGroupKey, DetectorSettings

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
    DetectorHandler[AnalysisInputType, AnalysisResultType],
    Generic[AnalysisInputType, AnalysisResultType],
):
    """Call Seer inline, then use the standard condition and occurrence pipeline.

    Callers must run this handler in a background task with a deadline longer
    than the HTTP timeout. Scheduling, input selection and task retries belong
    to the caller. Subclasses prepare prompt input, validate/translate the LLM
    result into grouped evaluation values, and implement ``create_occurrence``.
    Each evaluation makes one Seer request, regardless of the number of groups.

    Draft: the synchronous Seer endpoint is not implemented. No production
    detector is registered here. HTTP routing deadlines, worker capacity and
    Seer's execution budget must be agreed before enabling a concrete detector.
    """

    seer_timeout: int = 50

    @abc.abstractmethod
    def get_prompt_input(self, data_packet: DataPacket[AnalysisInputType]) -> dict[str, Any]:
        """Prepare the input for the code-owned prompt selected by prompt_key."""
        raise NotImplementedError

    @abc.abstractmethod
    def parse_result(self, result: dict[str, Any]) -> dict[DetectorGroupKey, AnalysisResultType]:
        """Validate the result and return values with distinct, stable group keys.

        Return an empty mapping for a successful analysis with no findings.
        Raise for an invalid or incomplete analysis, rather than treating it as
        a successful empty result. Occurrence builders can read each value from
        the condition evaluation's ``data`` without making another LLM call.
        """
        raise NotImplementedError

    def extract_value(
        self, data_packet: DataPacket[AnalysisInputType]
    ) -> dict[DetectorGroupKey, AnalysisResultType]:
        project = self.detector.project
        if project is None:
            raise ValueError("LLM detectors require a project")

        request = LLMDetectorRequest(
            prompt_key=self.detector.config["prompt_key"],
            model=self.detector.config["model"],
            prompt_input=self.get_prompt_input(data_packet),
        )
        if "temperature" in self.detector.config:
            request["temperature"] = self.detector.config["temperature"]

        response = make_llm_detector_request(
            request,
            timeout=self.seer_timeout,
            viewer_context=SeerViewerContext(
                organization_id=project.organization_id,
            ),
        )
        if response.status != 200:
            # A legacy 202 is submission, never a completed evaluation.
            raise SeerApiError("Expected a completed LLM detector evaluation", response.status)

        try:
            envelope = orjson.loads(response.data)
        except orjson.JSONDecodeError as error:
            raise SeerApiResponseValidationError("Expected a JSON LLM detector response") from error
        if not isinstance(envelope, dict) or not isinstance(envelope.get("result"), dict):
            raise SeerApiResponseValidationError("Expected an LLM detector result object")

        return self.parse_result(envelope["result"])

    def _extract_value_from_packet(
        self, data_packet: DataPacket[AnalysisInputType]
    ) -> dict[DetectorGroupKey, AnalysisResultType]:
        # This handler always returns groups. In particular, {} means no findings,
        # whereas the default normalizer treats {} as one ungrouped scalar value.
        return self.extract_value(data_packet)
