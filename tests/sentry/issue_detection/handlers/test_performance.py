from typing import Any

from sentry.issue_detection.detectors.io_main_thread_detector import DBMainThreadDetector
from sentry.issue_detection.detectors.slow_db_query_detector import SlowDBQueryDetector
from sentry.issue_detection.handlers.performance import PerformanceDetectorHandler
from sentry.issue_detection.performance_detection import (
    get_detection_settings,
    run_detector_on_data,
)
from sentry.issue_detection.performance_problem import PerformanceProblem
from sentry.issues.grouptype import (
    GroupType,
    PerformanceDBMainThreadGroupType,
    PerformanceSlowDBQueryGroupType,
    QueryInjectionVulnerabilityGroupType,
)
from sentry.issues.issue_occurrence import IssueEvidence, IssueOccurrence
from sentry.testutils.cases import TestCase
from sentry.testutils.issue_detection.event_generators import get_event
from sentry.workflow_engine.models import DataPacket
from sentry.workflow_engine.processors import DetectorEvaluation
from sentry.workflow_engine.types import DetectorPriorityLevel

OFFENDER_SPAN_ID = "a" * 16


def build_problem(
    *,
    fingerprint: str = "1-1001-deadbeef",
    desc: str = "SELECT * FROM users WHERE id = %s",
    group_type: type[GroupType] = PerformanceSlowDBQueryGroupType,
    evidence_data: dict[str, Any] | None = None,
    evidence_display: list[IssueEvidence] | None = None,
) -> PerformanceProblem:
    return PerformanceProblem(
        fingerprint=fingerprint,
        op="db",
        desc=desc,
        type=group_type,
        parent_span_ids=[],
        cause_span_ids=[],
        offender_span_ids=[OFFENDER_SPAN_ID],
        evidence_data=evidence_data
        if evidence_data is not None
        else {"op": "db", "offender_span_ids": [OFFENDER_SPAN_ID], "transaction_name": "/checkout"},
        evidence_display=evidence_display if evidence_display is not None else [],
    )


def run_legacy_detector(
    detector_class: type[SlowDBQueryDetector] | type[DBMainThreadDetector],
    event: dict[str, Any],
) -> list[PerformanceProblem]:
    """A detector driven the way the ingest pipeline drives it."""
    settings = get_detection_settings()[detector_class.settings_key]

    detector = detector_class(settings, event)
    run_detector_on_data(detector, event)

    return list(detector.stored_problems.values())


class TestPerformanceDetectorHandler(TestCase):
    def setUp(self) -> None:
        self.detector = self.create_detector(
            name="Slow DB Query",
            project=self.project,
            type=PerformanceSlowDBQueryGroupType.slug,
        )

    def _evaluate(self, problem: PerformanceProblem) -> DetectorEvaluation:
        handler = PerformanceDetectorHandler(self.detector)
        results = handler.evaluate(DataPacket(source_id="1", packet=problem))

        assert list(results) == [None], "one packet is one problem, so the result is ungrouped"

        return results[None]

    def _occurrence(self, problem: PerformanceProblem) -> IssueOccurrence:
        occurrence = self._evaluate(problem).result
        assert isinstance(occurrence, IssueOccurrence)

        return occurrence

    def test_problem_becomes_an_occurrence(self) -> None:
        problem = build_problem()

        occurrence = self._occurrence(problem)

        assert occurrence.issue_title == PerformanceSlowDBQueryGroupType.description
        assert occurrence.subtitle == problem.desc
        assert occurrence.type is PerformanceSlowDBQueryGroupType
        assert occurrence.fingerprint == [problem.fingerprint]

    def test_evaluation_is_ungrouped_and_triggered(self) -> None:
        evaluation = self._evaluate(build_problem())

        assert evaluation.triggered is True
        assert evaluation.data["group_key"] is None

    def test_priority_comes_from_the_problems_group_type(self) -> None:
        """Read off the problem, not the detector row, so it agrees with the occurrence."""
        slow_query = self._evaluate(build_problem())
        injection = self._evaluate(build_problem(group_type=QueryInjectionVulnerabilityGroupType))

        assert slow_query.priority == DetectorPriorityLevel.LOW
        assert injection.priority == DetectorPriorityLevel.MEDIUM

    def test_detector_evidence_is_carried_through_verbatim(self) -> None:
        problem = build_problem(
            evidence_data={"op": "db", "transaction_name": "/checkout"},
            evidence_display=[
                IssueEvidence(name="Offending Spans", value="db - SELECT", important=True)
            ],
        )

        occurrence = self._occurrence(problem)

        assert occurrence.evidence_data.items() >= problem.evidence_data.items()
        assert occurrence.evidence_display == problem.evidence_display

    def test_occurrence_carries_the_detector_back_to_the_workflow_engine(self) -> None:
        occurrence = self._occurrence(build_problem())

        assert occurrence.evidence_data["detector_id"] == self.detector.id
        assert occurrence.evidence_data["data_packet_source_id"] == "1"
        assert occurrence.evidence_data["config"] == self.detector.config
        assert occurrence.project_id == self.project.id

    def test_event_data_is_stamped_from_the_occurrence(self) -> None:
        """The Issue Platform rejects the pair if the event ids disagree."""
        evaluation = self._evaluate(build_problem())
        occurrence = evaluation.result
        assert isinstance(occurrence, IssueOccurrence)

        event_data = evaluation.data["event_data"]
        assert event_data is not None
        assert event_data["event_id"] == occurrence.event_id
        assert event_data["project_id"] == occurrence.project_id
        assert event_data["timestamp"] == occurrence.detection_time
        assert event_data["received"] == occurrence.detection_time

    def test_evaluation_reports_no_condition_group_evaluation(self) -> None:
        """There is no DataConditionGroup, so none is invented to fill the field."""
        evaluation = self._evaluate(build_problem())

        assert "trigger_group_evaluation" not in evaluation.data
        assert evaluation.to_artifact()["trigger_group_evaluation"] is None

    def test_each_packet_gets_its_own_event_id(self) -> None:
        problem = build_problem()

        assert self._occurrence(problem).event_id != self._occurrence(problem).event_id


class TestMappingLegacyDetectorOutput(TestCase):
    """
    End to end over the seam `detect_performance_problems` will hand us: run a real
    detector, map what it found, and check the occurrence lands where the legacy pipeline
    would have put it.
    """

    def _occurrence(
        self, problem: PerformanceProblem, group_type: type[GroupType]
    ) -> IssueOccurrence:
        detector = self.create_detector(project=self.project, type=group_type.slug)
        results = PerformanceDetectorHandler(detector).evaluate(
            DataPacket(source_id="1", packet=problem)
        )

        occurrence = results[None].result
        assert isinstance(occurrence, IssueOccurrence)

        return occurrence

    def test_maps_a_slow_query_problem(self) -> None:
        event = {
            "spans": [
                {
                    "span_id": OFFENDER_SPAN_ID,
                    "start_timestamp": 0.0,
                    "timestamp": 2.0,
                    "op": "db",
                    "description": "SELECT * FROM users WHERE id = %s",
                    "hash": "deadbeef",
                }
            ]
        }
        problems = run_legacy_detector(SlowDBQueryDetector, event)
        assert len(problems) == 1

        occurrence = self._occurrence(problems[0], PerformanceSlowDBQueryGroupType)

        assert occurrence.fingerprint == [problems[0].fingerprint]
        assert occurrence.issue_title == PerformanceSlowDBQueryGroupType.description
        assert occurrence.evidence_data["offender_span_ids"] == [OFFENDER_SPAN_ID]

    def test_maps_a_db_main_thread_problem(self) -> None:
        """
        Reproduces the fingerprint hardcoded in
        `tests/sentry/issue_detection/test_db_main_thread_detector.py`, so the port lands in
        the Issue Platform groups the legacy pipeline already creates.
        """
        problems = run_legacy_detector(
            DBMainThreadDetector, get_event("db-on-main-thread/db-on-main-thread")
        )
        assert len(problems) == 1

        occurrence = self._occurrence(problems[0], PerformanceDBMainThreadGroupType)

        assert occurrence.fingerprint == [
            f"1-{PerformanceDBMainThreadGroupType.type_id}-86f1961bdc10a14809866c6a6ec0033797123ba9"
        ]
        assert occurrence.issue_title == "DB on Main Thread"
        assert occurrence.subtitle == "SELECT * FROM my_cool_database WHERE some_col=some_val"
        assert occurrence.evidence_data["offender_span_ids"] == ["054ba3a374d543eb"]
