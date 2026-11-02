from __future__ import annotations

from datetime import timedelta
from typing import Any

from sentry.incidents.grouptype import MetricIssue
from sentry.incidents.metric_issue_detector import fetch_snuba_query
from sentry.incidents.utils.constants import INCIDENTS_SNUBA_SUBSCRIPTION_TYPE
from sentry.incidents.utils.subscription_limits import METRIC_SUBSCRIPTION_FEATURE_FLAGS
from sentry.investigations.services.action_kinds.update_detector import (
    DetectorChanges,
    DetectorState,
)
from sentry.snuba.dataset import Dataset
from sentry.snuba.models import ExtrapolationMode, SnubaQuery, SnubaQueryEventType
from sentry.snuba.subscriptions import create_snuba_query, create_snuba_subscription
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.features import with_feature
from sentry.testutils.skips import requires_kafka, requires_snuba
from sentry.workflow_engine.models import DataConditionGroup, Detector
from sentry.workflow_engine.models.data_condition import Condition
from sentry.workflow_engine.types import DetectorPriorityLevel

pytestmark = [requires_snuba, requires_kafka]


@with_feature(METRIC_SUBSCRIPTION_FEATURE_FLAGS)
class DetectorStateTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.detector = self.create_metric_detector()

    def create_metric_detector(
        self,
        *,
        eap: bool = False,
        extrapolation_mode: ExtrapolationMode = ExtrapolationMode.CLIENT_AND_SERVER_WEIGHTED,
    ) -> Detector:
        with self.tasks():
            snuba_query = create_snuba_query(
                query_type=SnubaQuery.Type.PERFORMANCE if eap else SnubaQuery.Type.ERROR,
                dataset=Dataset.EventsAnalyticsPlatform if eap else Dataset.Events,
                query="span.op:http.client" if eap else "level:error",
                aggregate="count(span.duration)" if eap else "count()",
                time_window=timedelta(minutes=5),
                resolution=timedelta(minutes=1),
                environment=None,
                event_types=[
                    SnubaQueryEventType.EventType.TRACE_ITEM_SPAN
                    if eap
                    else SnubaQueryEventType.EventType.ERROR
                ],
                extrapolation_mode=extrapolation_mode if eap else None,
            )
            subscription = create_snuba_subscription(
                project=self.project,
                subscription_type=INCIDENTS_SNUBA_SUBSCRIPTION_TYPE,
                snuba_query=snuba_query,
            )
        group = self.create_data_condition_group(
            organization_id=self.organization.id, logic_type=DataConditionGroup.Type.ANY
        )
        for condition_type, result in [
            (Condition.GREATER, DetectorPriorityLevel.HIGH),
            (Condition.LESS_OR_EQUAL, DetectorPriorityLevel.OK),
        ]:
            self.create_data_condition(
                condition_group=group,
                type=condition_type,
                comparison=500.0,
                condition_result=result,
            )
        detector = self.create_detector(
            project=self.project,
            type=MetricIssue.slug,
            workflow_condition_group=group,
            config={"detection_type": "static"},
        )
        data_source = self.create_data_source(
            organization=self.organization, source_id=subscription.id
        )
        self.create_data_source_detector(data_source=data_source, detector=detector)
        return detector

    def state(self) -> DetectorState:
        snuba_query = fetch_snuba_query(self.detector)
        assert snuba_query is not None
        return DetectorState.load(self.detector, snuba_query)

    def validation_errors(self, changes: DetectorChanges) -> dict[str, Any] | None:
        """Send the update through the detector validator, the way the detector API would."""
        settings = self.detector.group_type.detector_settings
        assert settings is not None and settings.validator is not None
        validator = settings.validator(
            instance=self.detector,
            context={"project": self.project, "organization": self.organization},
            data=self.state().update(changes),
            partial=True,
        )
        return None if validator.is_valid() else validator.errors

    def test_reads_the_current_values(self) -> None:
        assert self.state().values() == {
            "timeWindowSeconds": 300,
            "query": "level:error",
            "aggregate": "count()",
            "environment": None,
            "highThreshold": 500.0,
            "resolutionThreshold": 500.0,
        }

    def test_a_valid_change_has_no_errors(self) -> None:
        assert self.validation_errors({"timeWindowSeconds": 900}) is None

    def test_a_threshold_change_passes_the_validator(self) -> None:
        assert (
            self.validation_errors({"highThreshold": 800.0, "resolutionThreshold": 800.0}) is None
        )

    def test_a_threshold_change_updates_its_condition_and_keeps_the_rest(self) -> None:
        update = self.state().update({"highThreshold": 800.0})

        assert update.keys() == {"conditionGroup"}
        conditions = update["conditionGroup"]["conditions"]
        assert [(c["conditionResult"], c["comparison"]) for c in conditions] == [
            (DetectorPriorityLevel.HIGH, 800.0),
            (DetectorPriorityLevel.OK, 500.0),
        ]

    def test_a_time_window_change_only_touches_the_data_source(self) -> None:
        update = self.state().update({"timeWindowSeconds": 900})

        assert update.keys() == {"dataSources"}
        [data_source] = update["dataSources"]
        assert data_source["timeWindow"] == 900
        assert data_source["query"] == "level:error"

    def test_a_group_by_monitor_can_still_change(self) -> None:
        snuba_query = fetch_snuba_query(self.detector)
        assert snuba_query is not None
        snuba_query.update(group_by=["transaction"])

        assert "groupBy" not in self.state().update({"timeWindowSeconds": 900})["dataSources"][0]
        assert self.validation_errors({"timeWindowSeconds": 900}) is None

    def test_a_span_monitor_can_change_its_window(self) -> None:
        self.detector = self.create_metric_detector(eap=True)

        assert self.validation_errors({"timeWindowSeconds": 900}) is None

    def test_a_migrated_span_monitor_keeps_its_extrapolation_mode(self) -> None:
        self.detector = self.create_metric_detector(
            eap=True, extrapolation_mode=ExtrapolationMode.SERVER_WEIGHTED
        )

        [data_source] = self.state().update({"timeWindowSeconds": 900})["dataSources"]

        assert "extrapolationMode" not in data_source
        assert self.validation_errors({"timeWindowSeconds": 900}) is None

    def test_an_invalid_window_returns_the_validator_errors(self) -> None:
        self.detector = self.create_metric_detector(eap=True)

        errors = self.validation_errors({"timeWindowSeconds": 450})

        assert "Invalid Time Window" in str(errors)
