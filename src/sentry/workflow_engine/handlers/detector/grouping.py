import abc
from datetime import UTC, datetime
from typing import Generic
from uuid import uuid4

from sentry.issues.issue_occurrence import IssueOccurrence
from sentry.issues.status_change_message import StatusChangeMessage
from sentry.models.group import GroupStatus
from sentry.utils import metrics
from sentry.workflow_engine.handlers.detector.base import DataPacketEvaluationType, DataPacketType
from sentry.workflow_engine.handlers.detector.stateful import (
    DetectorStateData,
    StatefulDetectorHandler,
)
from sentry.workflow_engine.models import DataPacket
from sentry.workflow_engine.types import (
    DetectorEvaluationResult,
    DetectorGroupKey,
    DetectorPriorityLevel,
)


class GroupingDetectorHandler(
    Generic[DataPacketType, DataPacketEvaluationType],
    StatefulDetectorHandler[DataPacketType, DataPacketEvaluationType],
    abc.ABC,
):
    @abc.abstractmethod
    def extract_group_values(
        self, data_packet: DataPacket[DataPacketType]
    ) -> dict[DetectorGroupKey, DataPacketEvaluationType]:
        """
        Extracts the values for all the group keys that exist in the given data packet,
        and returns then as a dict keyed by group_key.
        """
        pass

    def build_group_fingerprint(self, group_key: DetectorGroupKey) -> list[str]:
        """
        Builds a fingerprint to uniquely identify a detected issue

        TODO - Take into account the data source / query that triggered the detector,
        we'll want to create a new issue if the query changes.
        """
        return [self.build_key_for_group(group_key)]

    def build_key_for_group(self, group_key: DetectorGroupKey, postfix: str | None = None) -> str:
        """
        Builds a key for the given group key. This is used to store the state of the detector in Redis.
        """
        group_postfix = f"{group_key if group_key is not None else ''}"

        if postfix:
            group_postfix = f"{group_key if group_key is not None else ''}:{postfix}"

        fingerprint = self.build_fingerprint(group_postfix)
        return fingerprint

    def evaluate(
        self, data_packet: DataPacket[DataPacketType]
    ) -> dict[DetectorGroupKey, DetectorEvaluationResult]:
        """
        Overrides the best evaluation method, to evaluate in groups instead.
        """
        return self.evaluate_groups(data_packet)

    def evaluate_groups(
        self,
        data_packet: DataPacket[DataPacketType],
    ) -> dict[DetectorGroupKey, DetectorEvaluationResult]:
        dedupe_value = self.extract_dedupe_value(data_packet)
        group_values = self.extract_group_values(data_packet)
        all_state_data = self.state_manager.get_state_data(list(group_values.keys()))
        results = {}

        for group_key, group_value in group_values.items():
            # invoke the stateful detector with the associated data. doesn't need the group key for evaluation
            # results returned here will be then committed in bulk
            result = self.evaluate_group_key_value(
                group_key,
                group_value,
                all_state_data[group_key],
                dedupe_value,
                data_packet,
            )
            if result:
                results[result.group_key] = result

        self.state_manager.commit_state_updates()
        return results

    def evaluate_group_key_value(
        self,
        group_key: DetectorGroupKey,
        value: DataPacketEvaluationType,
        state_data: DetectorStateData,
        dedupe_value: int,
        data_packet: DataPacket[DataPacketType],
    ) -> DetectorEvaluationResult | None:
        """
        Evaluates a value associated with a given `group_key` and returns a `DetectorEvaluationResult` with the results
        and any state changes that need to be made.

        Checks that we haven't already processed this datapacket for this group_key, and skips evaluation if we have.
        """
        # TODO - compose this method using the helpers in the base class.
        if dedupe_value <= state_data.dedupe_value:
            metrics.incr("workflow_engine.detector.skipping_already_processed_update")
            return None

        self.state_manager.enqueue_dedupe_update(group_key, dedupe_value)

        if not self.condition_group:
            metrics.incr("workflow_engine.detector.skipping_invalid_condition_group")
            return None

        new_status = DetectorPriorityLevel.OK
        processed_data_condition, new_status = self._evaluation_detector_conditions(value)

        # TODO - add upate for the thresholds here...
        # self.state_manager.update_thresholds(group_key, new_status)
        self.state_manager.enqueue_counter_update(group_key, {})

        if state_data.status == new_status or not processed_data_condition:
            return None

        is_triggered = new_status != DetectorPriorityLevel.OK
        self.state_manager.enqueue_state_update(group_key, is_triggered, new_status)

        event_data = None
        result: StatusChangeMessage | IssueOccurrence

        if new_status == DetectorPriorityLevel.OK:
            result = StatusChangeMessage(
                fingerprint=self.build_group_fingerprint(group_key),
                project_id=self.detector.project_id,
                new_status=GroupStatus.RESOLVED,
                new_substatus=None,
            )
        else:
            detector_occurrence, event_data = self.create_occurrence(
                processed_data_condition, data_packet, new_status
            )
            evidence_data = {
                **detector_occurrence.evidence_data,
                "detector_id": self.detector.id,
                "value": value,
            }
            result = detector_occurrence.to_issue_occurrence(
                occurrence_id=str(uuid4()),
                project_id=self.detector.project_id,
                status=new_status,
                detection_time=datetime.now(UTC),
                additional_evidence_data=evidence_data,
                fingerprint=self.build_group_fingerprint(group_key),
            )
            event_data["timestamp"] = result.detection_time
            event_data["project_id"] = result.project_id
            event_data["event_id"] = result.event_id
            event_data.setdefault("platform", "python")
            event_data.setdefault("received", result.detection_time)
            event_data.setdefault("tags", {})

        return DetectorEvaluationResult(
            group_key=group_key,
            is_triggered=is_triggered,
            priority=new_status,
            result=result,
            event_data=event_data,
        )
