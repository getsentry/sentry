from sentry.incidents.grouptype import MetricIssueDetectorHandler
from sentry.issues.issue_occurrence import IssueOccurrence
from sentry.testutils.helpers.datetime import freeze_time
from sentry.workflow_engine.models import DataCondition
from sentry.workflow_engine.models.data_condition import Condition
from tests.sentry.incidents.utils.test_metric_issue_base import BaseMetricIssueTest


@freeze_time()
class TestEvaluateMetricDetector(BaseMetricIssueTest):
    def setUp(self):
        super().setUp()
        self.handler = MetricIssueDetectorHandler(self.detector)

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

    def verify_issue_occurrence(
        self, occurrence: IssueOccurrence, evidence_data: dict, detector_trigger: DataCondition
    ) -> None:
        assert occurrence is not None
        assert occurrence.issue_title == self.detector.name
        assert occurrence.subtitle == self.handler.construct_title(
            snuba_query=self.snuba_query,
            detector_trigger=detector_trigger,
            priority=detector_trigger.condition_result,
        )
        assert occurrence.evidence_data == evidence_data
        assert occurrence.level == "error"
        assert occurrence.priority == detector_trigger.condition_result
        assert occurrence.assignee
        assert occurrence.assignee.id == self.detector.created_by_id

    def test_metric_issue_occurrence(self):
        value = self.critical_detector_trigger.comparison + 1
        data_packet = self.create_subscription_packet(value)
        evidence_data = self.generate_evidence_data(
            value, self.critical_detector_trigger, self.warning_detector_trigger
        )

        occurrence = self.process_packet_and_return_result(data_packet)
        assert isinstance(occurrence, IssueOccurrence)

        self.verify_issue_occurrence(occurrence, evidence_data, self.critical_detector_trigger)

    def test_warning_level(self):
        value = self.warning_detector_trigger.comparison + 1
        data_packet = self.create_subscription_packet(value)
        evidence_data = self.generate_evidence_data(value, self.warning_detector_trigger)

        occurrence = self.process_packet_and_return_result(data_packet)
        assert isinstance(occurrence, IssueOccurrence)

        self.verify_issue_occurrence(occurrence, evidence_data, self.warning_detector_trigger)

    def test_does_not_trigger(self):
        value = self.warning_detector_trigger.comparison - 1
        data_packet = self.create_subscription_packet(value)
        result = self.process_packet_and_return_result(data_packet)
        assert result is None

    def test_missing_detector_trigger(self):
        value = self.critical_detector_trigger.comparison + 1
        data_packet = self.create_subscription_packet(value)
        DataCondition.objects.all().delete()
        result = self.process_packet_and_return_result(data_packet)
        assert result is None

    def test_flipped_detector_trigger(self):
        self.warning_detector_trigger.delete()
        self.critical_detector_trigger.update(type=Condition.LESS)
        value = self.critical_detector_trigger.comparison - 1
        data_packet = self.create_subscription_packet(value)
        evidence_data = self.generate_evidence_data(value, self.critical_detector_trigger)

        occurrence = self.process_packet_and_return_result(data_packet)
        assert isinstance(occurrence, IssueOccurrence)

        self.verify_issue_occurrence(occurrence, evidence_data, self.critical_detector_trigger)


class TestConstructTitle(TestEvaluateMetricDetector):
    def test_title_critical(self):
        title = self.handler.construct_title(
            snuba_query=self.snuba_query,
            detector_trigger=self.critical_detector_trigger,
            priority=self.critical_detector_trigger.condition_result,
        )
        assert (
            title
            == f"Critical: Number of events in the last minute above {self.critical_detector_trigger.comparison}"
        )

    def test_title_warning(self):
        title = self.handler.construct_title(
            snuba_query=self.snuba_query,
            detector_trigger=self.warning_detector_trigger,
            priority=self.warning_detector_trigger.condition_result,
        )
        assert (
            title
            == f"Warning: Number of events in the last minute above {self.warning_detector_trigger.comparison}"
        )

    def test_title_comparison_delta(self):
        self.detector.config.update({"comparison_delta": 60 * 60})

        title = self.handler.construct_title(
            snuba_query=self.snuba_query,
            detector_trigger=self.critical_detector_trigger,
            priority=self.critical_detector_trigger.condition_result,
        )
        assert (
            title
            == "Critical: Number of events in the last minute greater than same time one hour ago"
        )

    def test_title_below_threshold(self):
        self.warning_detector_trigger.type = Condition.LESS
        self.warning_detector_trigger.save()

        title = self.handler.construct_title(
            snuba_query=self.snuba_query,
            detector_trigger=self.warning_detector_trigger,
            priority=self.warning_detector_trigger.condition_result,
        )
        assert (
            title
            == f"Warning: Number of events in the last minute below {self.warning_detector_trigger.comparison}"
        )

    def test_title_different_aggregate(self):
        self.snuba_query.aggregate = "count_unique(tags[sentry:user])"
        title = self.handler.construct_title(
            snuba_query=self.snuba_query,
            detector_trigger=self.critical_detector_trigger,
            priority=self.critical_detector_trigger.condition_result,
        )
        assert (
            title
            == f"Critical: Number of users affected in the last minute above {self.critical_detector_trigger.comparison}"
        )

        self.snuba_query.aggregate = "percentage(sessions_crashed, sessions)"
        title = self.handler.construct_title(
            snuba_query=self.snuba_query,
            detector_trigger=self.critical_detector_trigger,
            priority=self.critical_detector_trigger.condition_result,
        )
        assert (
            title
            == f"Critical: Crash free session rate in the last minute above {self.critical_detector_trigger.comparison}"
        )
