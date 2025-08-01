from datetime import UTC, datetime, timedelta, timezone

from sentry.incidents.grouptype import MetricIssue, MetricIssueDetectorHandler
from sentry.incidents.utils.constants import INCIDENTS_SNUBA_SUBSCRIPTION_TYPE
from sentry.incidents.utils.types import (
    DATA_SOURCE_SNUBA_QUERY_SUBSCRIPTION,
    ProcessedSubscriptionUpdate,
    QuerySubscriptionUpdate,
)
from sentry.issues.issue_occurrence import IssueOccurrence
from sentry.issues.status_change_message import StatusChangeMessage
from sentry.snuba.dataset import Dataset
from sentry.snuba.models import SnubaQuery, SnubaQueryEventType
from sentry.snuba.subscriptions import create_snuba_query, create_snuba_subscription
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.datetime import freeze_time
from sentry.workflow_engine.models import Condition, DataCondition, DataPacket
from sentry.workflow_engine.processors.data_packet import process_data_packet
from sentry.workflow_engine.types import (
    DetectorEvaluationResult,
    DetectorGroupKey,
    DetectorPriorityLevel,
)


class BaseMetricIssueTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.detector_group_key = None
        self.detector = self.create_detector(
            project=self.project,
            workflow_condition_group=self.create_data_condition_group(),
            type=MetricIssue.slug,
            created_by_id=self.user.id,
        )
        self.critical_detector_trigger = self.create_data_condition(
            type=Condition.GREATER,
            comparison=5,
            condition_result=DetectorPriorityLevel.HIGH,
            condition_group=self.detector.workflow_condition_group,
        )
        self.warning_detector_trigger = self.create_data_condition(
            comparison=3,
            type=Condition.GREATER,
            condition_result=DetectorPriorityLevel.MEDIUM,
            condition_group=self.detector.workflow_condition_group,
        )
        self.resolve_detector_trigger = self.create_data_condition(
            type=Condition.LESS,
            comparison=3,
            condition_result=DetectorPriorityLevel.OK,
            condition_group=self.detector.workflow_condition_group,
        )

        with self.tasks():
            self.snuba_query = create_snuba_query(
                query_type=SnubaQuery.Type.ERROR,
                dataset=Dataset.Events,
                query="hello",
                aggregate="count()",
                time_window=timedelta(minutes=1),
                resolution=timedelta(minutes=1),
                environment=self.environment,
                event_types=[SnubaQueryEventType.EventType.ERROR],
            )
            self.query_subscription = create_snuba_subscription(
                project=self.detector.project,
                subscription_type=INCIDENTS_SNUBA_SUBSCRIPTION_TYPE,
                snuba_query=self.snuba_query,
            )
        self.data_source = self.create_data_source(
            organization=self.organization,
            source_id=str(self.query_subscription.id),
            type=DATA_SOURCE_SNUBA_QUERY_SUBSCRIPTION,
        )
        self.create_data_source_detector(self.data_source, self.detector)

        self.alert_rule = self.create_alert_rule()
        self.create_alert_rule_detector(alert_rule_id=self.alert_rule.id, detector=self.detector)

    def create_subscription_packet(
        self, value: int, time_jump: int = 0
    ) -> DataPacket[ProcessedSubscriptionUpdate]:
        # XXX: the timestamp here is just used as a dedupe value, so we can avoid using freeze_time
        # by providing a large timedelta
        packet = ProcessedSubscriptionUpdate(
            entity="entity",
            subscription_id=str(self.query_subscription.id),
            values={"value": value},
            timestamp=datetime.now(UTC) + timedelta(minutes=time_jump),
        )
        return DataPacket[ProcessedSubscriptionUpdate](
            source_id=str(self.query_subscription.id), packet=packet
        )

    def process_packet_and_return_result(
        self, data_packet: DataPacket
    ) -> IssueOccurrence | StatusChangeMessage | None:
        results = process_data_packet(data_packet, DATA_SOURCE_SNUBA_QUERY_SUBSCRIPTION)
        if not results:
            # alert did not trigger
            return None
        evaluation_result: DetectorEvaluationResult = results[0][1][self.detector_group_key]
        return evaluation_result.result


@freeze_time()
class TestEvaluateMetricDetectorGroupBy(BaseMetricIssueTest):
    def setUp(self):
        super().setUp()
        self.detector = self.create_detector(
            project=self.project,
            workflow_condition_group=self.create_data_condition_group(),
            type=MetricIssue.slug,
            created_by_id=self.user.id,
        )
        self.critical_detector_trigger = self.create_data_condition(
            type=Condition.GREATER,
            comparison=5,
            condition_result=DetectorPriorityLevel.HIGH,
            condition_group=self.detector.workflow_condition_group,
        )
        self.warning_detector_trigger = self.create_data_condition(
            comparison=3,
            type=Condition.GREATER,
            condition_result=DetectorPriorityLevel.MEDIUM,
            condition_group=self.detector.workflow_condition_group,
        )
        with self.tasks():
            self.snuba_query = create_snuba_query(
                query_type=SnubaQuery.Type.ERROR,
                dataset=Dataset.Events,
                query="hello",
                aggregate="count()",
                time_window=timedelta(minutes=1),
                resolution=timedelta(minutes=1),
                environment=self.environment,
                event_types=[SnubaQueryEventType.EventType.ERROR],
                group_by=["level"],
            )
            self.query_subscription = create_snuba_subscription(
                project=self.detector.project,
                subscription_type=INCIDENTS_SNUBA_SUBSCRIPTION_TYPE,
                snuba_query=self.snuba_query,
            )
        self.alert_rule = self.create_alert_rule()
        self.create_alert_rule_detector(alert_rule_id=self.alert_rule.id, detector=self.detector)

        self.handler = MetricIssueDetectorHandler(self.detector)

    def test_metric_issue_occurrence(self):
        self.detector_group_keys = ["level=error", "level=warning"]
        self.detector_group_values = {
            "groups": [
                {
                    "group_keys": {"level": "error"},
                    "value": self.critical_detector_trigger.comparison + 1,
                },
                {
                    "group_keys": {"level": "warning"},
                    "value": self.warning_detector_trigger.comparison + 2,
                },
            ],
        }
        self.threshold_values = ["Critical", "Warning"]
        self.comparison_values = [5, 3]

        packet = ProcessedSubscriptionUpdate(
            entity="entity",
            subscription_id=str(self.query_subscription.id),
            values=self.detector_group_values,
            timestamp=datetime.now(timezone.utc),
        )
        data_packet = DataPacket[QuerySubscriptionUpdate](
            source_id=str(self.query_subscription.id), packet=packet
        )

        result: dict[DetectorGroupKey, DetectorEvaluationResult] = self.handler.evaluate(
            data_packet
        )
        for detector_group_key, detector_group_value, threshold_value, comparison_value in zip(
            self.detector_group_keys,
            self.detector_group_values["groups"],
            self.threshold_values,
            self.comparison_values,
        ):
            evaluation_result: DetectorEvaluationResult = result[detector_group_key]
            assert isinstance(evaluation_result.result, IssueOccurrence)
            occurrence: IssueOccurrence = evaluation_result.result
            assert occurrence is not None
            assert occurrence.issue_title == self.detector.name
            assert (
                occurrence.subtitle
                == f"{detector_group_key} {threshold_value}: Number of events in the last minute above {comparison_value}"
            )
            assert occurrence.level == "error"

    def generate_evidence_data(
        self,
        value: int,
        detector_trigger: DataCondition,
        extra_trigger: DataCondition | None = None,
    ):
        evidence_data = {
            "detector_id": self.detector.id,
            "value": detector_trigger.condition_result,
            "alert_id": self.alert_rule.id,
            "data_packet_source_id": str(self.query_subscription.id),
            "conditions": [
                {
                    "id": detector_trigger.id,
                    "type": detector_trigger.type,
                    "comparison": detector_trigger.comparison,
                    "condition_result": detector_trigger.condition_result.value,
                },
            ],
        }
        if extra_trigger:
            evidence_data["conditions"].append(
                {
                    "id": extra_trigger.id,
                    "type": extra_trigger.type,
                    "comparison": extra_trigger.comparison,
                    "condition_result": extra_trigger.condition_result.value,
                }
            )
        return evidence_data
