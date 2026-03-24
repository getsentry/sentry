from datetime import timedelta
from unittest.mock import patch
from uuid import uuid4

from django.db import IntegrityError

from sentry.monitors.types import DATA_SOURCE_CRON_MONITOR
from sentry.monitors.utils import (
    _fetch_associated_groups_eap,
    _fetch_associated_groups_snuba,
    ensure_cron_detector,
    ensure_cron_detector_deletion,
    get_detector_for_monitor,
)
from sentry.testutils.cases import SnubaTestCase, TestCase
from sentry.testutils.helpers.datetime import before_now, freeze_time
from sentry.workflow_engine.models import DataSource, DataSourceDetector, Detector


class EnsureCronDetectorTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.monitor = self.create_monitor(owner_user_id=None)

    def test_creates_data_source_and_detector_for_new_monitor(self) -> None:
        assert not get_detector_for_monitor(self.monitor)
        detector = ensure_cron_detector(self.monitor)
        assert detector is not None
        assert detector.type == "monitor_check_in_failure"
        assert detector.project_id == self.monitor.project_id
        assert detector.name == self.monitor.name
        assert detector.owner_user_id == self.monitor.owner_user_id
        assert detector.owner_team_id == self.monitor.owner_team_id

    def test_idempotent_for_existing_data_source(self) -> None:
        detector = ensure_cron_detector(self.monitor)
        assert detector is not None
        detector_after = ensure_cron_detector(self.monitor)
        assert detector_after is not None
        assert detector.id == detector_after.id

    def test_with_owner_user(self) -> None:
        self.monitor.owner_user_id = self.user.id
        self.monitor.save()
        detector = ensure_cron_detector(self.monitor)
        assert detector is not None
        assert detector.owner_user_id == self.user.id
        assert detector.owner_team_id is None

    def test_with_no_owner(self) -> None:
        detector = ensure_cron_detector(self.monitor)
        assert detector is not None
        assert detector.owner_user_id is None
        assert detector.owner_team_id is None

    def test_handles_database_errors_gracefully(self) -> None:
        with (
            patch("sentry.monitors.utils.logger") as mock_logger,
            patch("sentry.monitors.utils.DataSource.objects.get_or_create") as mock_get_or_create,
        ):
            mock_get_or_create.side_effect = IntegrityError("Database error")

            ensure_cron_detector(self.monitor)
            mock_logger.exception.assert_called_once_with("Error creating cron detector")
        assert not DataSource.objects.filter(
            type=DATA_SOURCE_CRON_MONITOR, source_id=str(self.monitor.id)
        ).exists()

    def test_atomic_transaction_rollback(self) -> None:
        with patch("sentry.monitors.utils.Detector.objects.create") as mock_create:
            mock_create.side_effect = IntegrityError("Cannot create detector")

            ensure_cron_detector(self.monitor)
        assert not DataSource.objects.filter(
            type=DATA_SOURCE_CRON_MONITOR, source_id=str(self.monitor.id)
        ).exists()


class GetDetectorForMonitorTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.monitor = self.create_monitor()

    def test_returns_none_when_no_detector_exists(self) -> None:
        detector = get_detector_for_monitor(self.monitor)
        assert detector is None

    def test_returns_detector_when_exists(self) -> None:
        ensure_cron_detector(self.monitor)

        detector = get_detector_for_monitor(self.monitor)
        assert detector is not None
        assert detector.type == "monitor_check_in_failure"
        assert detector.project_id == self.monitor.project_id
        assert detector.name == self.monitor.name

    def test_returns_correct_detector_for_specific_monitor(self) -> None:
        monitor1 = self.monitor
        monitor2 = self.create_monitor(name="Monitor 2")

        ensure_cron_detector(monitor1)
        ensure_cron_detector(monitor2)

        detector1 = get_detector_for_monitor(monitor1)
        detector2 = get_detector_for_monitor(monitor2)

        assert detector1 is not None
        assert detector2 is not None
        assert detector1.id != detector2.id
        assert detector1.name == monitor1.name
        assert detector2.name == monitor2.name


class EnsureCronDetectorDeletionTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.monitor = self.create_monitor()

    def test_deletes_data_source_and_detector(self) -> None:
        ensure_cron_detector(self.monitor)
        data_source = DataSource.objects.get(
            type=DATA_SOURCE_CRON_MONITOR,
            organization_id=self.monitor.organization_id,
            source_id=str(self.monitor.id),
        )
        datasource_detector = DataSourceDetector.objects.get(data_source=data_source)
        detector = datasource_detector.detector
        data_source_id = data_source.id
        detector_id = detector.id

        ensure_cron_detector_deletion(self.monitor)

        assert not DataSource.objects.filter(id=data_source_id).exists()
        assert not Detector.objects.filter(id=detector_id).exists()

    def test_does_nothing_when_no_data_source_exists(self) -> None:
        initial_datasource_count = DataSource.objects.count()
        initial_detector_count = Detector.objects.count()

        ensure_cron_detector_deletion(self.monitor)

        assert DataSource.objects.count() == initial_datasource_count
        assert Detector.objects.count() == initial_detector_count

    def test_deletes_only_data_source_when_no_detector_exists(self) -> None:
        data_source = DataSource.objects.create(
            type=DATA_SOURCE_CRON_MONITOR,
            organization_id=self.monitor.organization_id,
            source_id=str(self.monitor.id),
        )
        data_source_id = data_source.id

        ensure_cron_detector_deletion(self.monitor)

        assert not DataSource.objects.filter(id=data_source_id).exists()

    def test_deletes_correct_detector_for_specific_monitor(self) -> None:
        monitor1 = self.monitor
        monitor2 = self.create_monitor(name="Monitor 2")

        ensure_cron_detector(monitor1)
        ensure_cron_detector(monitor2)

        data_source1 = DataSource.objects.get(
            type=DATA_SOURCE_CRON_MONITOR,
            organization_id=monitor1.organization_id,
            source_id=str(monitor1.id),
        )
        datasource_detector1 = DataSourceDetector.objects.get(data_source=data_source1)
        detector1 = datasource_detector1.detector

        data_source2 = DataSource.objects.get(
            type=DATA_SOURCE_CRON_MONITOR,
            organization_id=monitor2.organization_id,
            source_id=str(monitor2.id),
        )
        datasource_detector2 = DataSourceDetector.objects.get(data_source=data_source2)
        detector2 = datasource_detector2.detector

        data_source1_id = data_source1.id
        detector1_id = detector1.id
        data_source2_id = data_source2.id
        detector2_id = detector2.id

        ensure_cron_detector_deletion(monitor1)

        assert not DataSource.objects.filter(id=data_source1_id).exists()
        assert not Detector.objects.filter(id=detector1_id).exists()
        assert DataSource.objects.filter(id=data_source2_id).exists()
        assert Detector.objects.filter(id=detector2_id).exists()

    def test_atomic_transaction_ensures_both_deleted(self) -> None:
        ensure_cron_detector(self.monitor)

        data_source = DataSource.objects.get(
            type=DATA_SOURCE_CRON_MONITOR,
            organization_id=self.monitor.organization_id,
            source_id=str(self.monitor.id),
        )
        datasource_detector = DataSourceDetector.objects.get(data_source=data_source)
        detector = datasource_detector.detector

        with patch("sentry.monitors.utils.Detector.delete") as mock_delete:
            mock_delete.side_effect = Exception("Cannot delete detector")

            try:
                ensure_cron_detector_deletion(self.monitor)
            except Exception:
                pass

        assert DataSource.objects.filter(id=data_source.id).exists()
        assert Detector.objects.filter(id=detector.id).exists()


class TestEAPFetchAssociatedGroups(TestCase, SnubaTestCase):
    FROZEN_TIME = before_now(hours=24).replace(hour=6, minute=0, second=0)

    def _event_timestamp(self) -> float:
        return (self.FROZEN_TIME - timedelta(minutes=5)).timestamp()

    def _query_both(
        self, trace_ids: list[str], project_id: int | None = None
    ) -> tuple[dict[int, set[str]], dict[int, set[str]]]:
        start = self.FROZEN_TIME - timedelta(hours=1)
        end = self.FROZEN_TIME + timedelta(hours=1)
        target_project_id = project_id or self.project.id

        snuba_result = _fetch_associated_groups_snuba(
            trace_ids, self.organization.id, target_project_id, start, end
        )
        eap_result = _fetch_associated_groups_eap(
            trace_ids, self.organization.id, target_project_id, start, end
        )
        return snuba_result, eap_result

    @freeze_time(FROZEN_TIME)
    def test_eap_and_snuba_match_multiple_traces_and_groups(self) -> None:
        trace_a = uuid4().hex
        trace_b = uuid4().hex
        ts = self._event_timestamp()

        group_a = self.store_events_to_snuba_and_eap(
            "monitor-group-a", count=2, trace_id=trace_a, timestamp=ts
        )[0].group_id
        group_b = self.store_events_to_snuba_and_eap(
            "monitor-group-b", count=1, trace_id=trace_a, timestamp=ts
        )[0].group_id
        group_a_again = self.store_events_to_snuba_and_eap(
            "monitor-group-a", count=1, trace_id=trace_b, timestamp=ts
        )[0].group_id

        assert group_a is not None
        assert group_b is not None
        assert group_a_again is not None
        assert group_a_again == group_a

        snuba_result, eap_result = self._query_both([trace_a, trace_b])

        assert eap_result == snuba_result
        assert snuba_result[group_a] == {trace_a, trace_b}
        assert snuba_result[group_b] == {trace_a}

    @freeze_time(FROZEN_TIME)
    def test_eap_and_snuba_isolate_by_trace(self) -> None:
        trace_a = uuid4().hex
        trace_b = uuid4().hex
        ts = self._event_timestamp()

        group_a = self.store_events_to_snuba_and_eap(
            "trace-isolate-a", count=1, trace_id=trace_a, timestamp=ts
        )[0].group_id
        self.store_events_to_snuba_and_eap(
            "trace-isolate-b", count=1, trace_id=trace_b, timestamp=ts
        )
        assert group_a is not None

        snuba_result, eap_result = self._query_both([trace_a])

        assert eap_result == snuba_result
        assert snuba_result == {group_a: {trace_a}}

    @freeze_time(FROZEN_TIME)
    def test_eap_and_snuba_isolate_by_project(self) -> None:
        other_project = self.create_project(organization=self.organization)
        trace_id = uuid4().hex
        ts = self._event_timestamp()

        local_group = self.store_events_to_snuba_and_eap(
            "project-isolate-local",
            count=1,
            trace_id=trace_id,
            timestamp=ts,
            project_id=self.project.id,
        )[0].group_id
        self.store_events_to_snuba_and_eap(
            "project-isolate-other",
            count=1,
            trace_id=trace_id,
            timestamp=ts,
            project_id=other_project.id,
        )
        assert local_group is not None

        snuba_result, eap_result = self._query_both([trace_id], project_id=self.project.id)

        assert eap_result == snuba_result
        assert snuba_result == {local_group: {trace_id}}

    @freeze_time(FROZEN_TIME)
    def test_eap_and_snuba_return_empty_when_no_matches(self) -> None:
        snuba_result, eap_result = self._query_both([uuid4().hex])

        assert snuba_result == {}
        assert eap_result == {}
