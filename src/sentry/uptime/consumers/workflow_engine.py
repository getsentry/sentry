from typing import Any, override

from sentry_kafka_schemas.schema_types.uptime_results_v1 import CheckResult, CheckStatus

from sentry.types.group import PriorityLevel
from sentry.uptime.models import get_uptime_subscription
from sentry.workflow_engine.handlers.detector.base import DetectorOccurrence
from sentry.workflow_engine.handlers.detector.stateful import StatefulGroupingDetectorHandler
from sentry.workflow_engine.models.data_source import DataPacket
from sentry.workflow_engine.types import DetectorGroupKey, DetectorPriorityLevel


class UptimeDetectorHandler(StatefulGroupingDetectorHandler[CheckResult, CheckStatus]):
    @override
    def get_dedupe_value(self, data_packet: DataPacket[CheckResult]) -> int:
        return int(data_packet.packet["scheduled_check_time_ms"])

    @override
    def get_group_key_values(
        self,
        data_packet: DataPacket[CheckResult],
    ) -> dict[DetectorGroupKey, CheckStatus]:
        return {None: data_packet.packet["status"]}

    @override
    @property
    def priority_transition_thresholds(self) -> dict[DetectorPriorityLevel, int]:
        """
        Require 3 uptime checks to fail before activating the detector.
        Likewise require 3 successful checks to recover.
        """
        return {
            DetectorPriorityLevel.OK: 3,
            DetectorPriorityLevel.HIGH: 3,
        }

    @override
    def build_fingerprint(self, group_key) -> list[str]:
        # TODO: Use `build_detector_fingerprint_component` from
        # https://github.com/getsentry/sentry/pull/91087. This needs to match
        # the fingerprints we're using for the old issues.
        return "TODO"

    @override
    def build_occurrence_and_event_data(
        self, group_key: DetectorGroupKey, new_status: PriorityLevel
    ) -> tuple[DetectorOccurrence, dict[str, Any]]:
        uptime_subscription = get_uptime_subscription(self.detector)
        # TODO: We need the datapacket here to pull things out, we should
        # either try and re-use some of the build_occurrence_from_result or
        # just copy paste here

        return (DetectorOccurrence(), {})
