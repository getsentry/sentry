from datetime import datetime, timezone
from unittest import mock
from unittest.mock import patch
from uuid import uuid4

from django.db import IntegrityError
from sentry_protos.snuba.v1.endpoint_trace_item_table_pb2 import (
    TraceItemColumnValues,
    TraceItemTableResponse,
)
from sentry_protos.snuba.v1.trace_item_attribute_pb2 import AttributeValue

from sentry.monitors.types import DATA_SOURCE_CRON_MONITOR
from sentry.monitors.utils import (
    _fetch_associated_groups_eap,
    ensure_cron_detector,
    ensure_cron_detector_deletion,
    fetch_associated_groups,
    get_detector_for_monitor,
)
from sentry.search.eap.occurrences.rollout_utils import EAPOccurrencesComparator
from sentry.snuba.occurrences_rpc import OccurrenceCategory
from sentry.testutils.cases import TestCase
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


class FetchAssociatedGroupsEAPTest(TestCase):
    @mock.patch("sentry.snuba.rpc_dataset_common.snuba_rpc.table_rpc")
    def test_eap_returns_group_id_trace_mapping(self, mock_table_rpc: mock.MagicMock) -> None:
        organization = self.create_organization()
        project = self.create_project(organization=organization)

        trace_id_1 = uuid4().hex
        trace_id_2 = uuid4().hex

        mock_response = TraceItemTableResponse(
            column_values=[
                TraceItemColumnValues(
                    attribute_name="group_id",
                    results=[
                        AttributeValue(val_int=100),
                        AttributeValue(val_int=200),
                        AttributeValue(val_int=100),
                    ],
                ),
                TraceItemColumnValues(
                    attribute_name="trace",
                    results=[
                        AttributeValue(val_str=trace_id_1),
                        AttributeValue(val_str=trace_id_1),
                        AttributeValue(val_str=trace_id_2),
                    ],
                ),
                TraceItemColumnValues(
                    attribute_name="count()",
                    results=[
                        AttributeValue(val_double=5.0),
                        AttributeValue(val_double=3.0),
                        AttributeValue(val_double=1.0),
                    ],
                ),
            ]
        )
        mock_table_rpc.return_value = [mock_response]

        now = datetime.now(tz=timezone.utc)
        result = _fetch_associated_groups_eap(
            trace_ids=[trace_id_1, trace_id_2],
            organization_id=organization.id,
            project_id=project.id,
            start=now,
            end=now,
        )

        assert result == {
            100: {trace_id_1, trace_id_2},
            200: {trace_id_1},
        }
        mock_table_rpc.assert_called_once()

    @mock.patch("sentry.snuba.occurrences_rpc.Occurrences.run_table_query")
    def test_eap_returns_empty_on_empty_response(
        self, mock_run_table_query: mock.MagicMock
    ) -> None:
        organization = self.create_organization()
        project = self.create_project(organization=organization)

        mock_run_table_query.return_value = {"data": [], "meta": {}}

        now = datetime.now(tz=timezone.utc)
        result = _fetch_associated_groups_eap(
            trace_ids=[uuid4().hex],
            organization_id=organization.id,
            project_id=project.id,
            start=now,
            end=now,
        )

        assert result == {}
        mock_run_table_query.assert_called_once()
        call_kwargs = mock_run_table_query.call_args[1]
        assert call_kwargs["occurrence_category"] == OccurrenceCategory.ERROR
        assert "type" not in call_kwargs["query_string"]

    @mock.patch("sentry.snuba.rpc_dataset_common.snuba_rpc.table_rpc")
    def test_eap_returns_empty_on_exception(self, mock_table_rpc: mock.MagicMock) -> None:
        organization = self.create_organization()
        project = self.create_project(organization=organization)

        mock_table_rpc.side_effect = Exception("RPC failed")

        now = datetime.now(tz=timezone.utc)
        result = _fetch_associated_groups_eap(
            trace_ids=[uuid4().hex],
            organization_id=organization.id,
            project_id=project.id,
            start=now,
            end=now,
        )

        assert result == {}


class FetchAssociatedGroupsDoubleReadTest(TestCase):
    @mock.patch("sentry.monitors.utils._fetch_associated_groups_eap")
    @mock.patch("sentry.monitors.utils._fetch_associated_groups_snuba")
    def test_uses_snuba_as_source_of_truth(
        self,
        mock_snuba: mock.MagicMock,
        mock_eap: mock.MagicMock,
    ) -> None:
        organization = self.create_organization()
        project = self.create_project(organization=organization)
        group1 = self.create_group(project=project)
        group2 = self.create_group(project=project)

        trace_id = uuid4().hex
        mock_snuba.return_value = {group1.id: {trace_id}, group2.id: {trace_id}}
        mock_eap.return_value = {group1.id: {trace_id}}

        now = datetime.now(tz=timezone.utc)
        with self.options({EAPOccurrencesComparator._should_eval_option_name(): True}):
            result = fetch_associated_groups([trace_id], organization.id, project.id, now, now)

        # Snuba result is used (both groups present)
        assert trace_id in result
        result_group_ids = {g["id"] for g in result[trace_id]}
        assert result_group_ids == {group1.id, group2.id}
        mock_snuba.assert_called_once()
        mock_eap.assert_called_once()

    @mock.patch("sentry.monitors.utils._fetch_associated_groups_eap")
    @mock.patch("sentry.monitors.utils._fetch_associated_groups_snuba")
    def test_uses_eap_as_source_of_truth_when_allowlisted(
        self,
        mock_snuba: mock.MagicMock,
        mock_eap: mock.MagicMock,
    ) -> None:
        organization = self.create_organization()
        project = self.create_project(organization=organization)
        group1 = self.create_group(project=project)
        group2 = self.create_group(project=project)

        trace_id = uuid4().hex
        mock_snuba.return_value = {group1.id: {trace_id}, group2.id: {trace_id}}
        mock_eap.return_value = {group1.id: {trace_id}}

        now = datetime.now(tz=timezone.utc)
        with self.options(
            {
                EAPOccurrencesComparator._should_eval_option_name(): True,
                EAPOccurrencesComparator._callsite_allowlist_option_name(): [
                    "monitors.fetch_associated_groups"
                ],
            }
        ):
            result = fetch_associated_groups([trace_id], organization.id, project.id, now, now)

        # EAP result is used (only group1)
        assert trace_id in result
        result_group_ids = {g["id"] for g in result[trace_id]}
        assert result_group_ids == {group1.id}
        mock_snuba.assert_called_once()
        mock_eap.assert_called_once()

    @mock.patch("sentry.monitors.utils._fetch_associated_groups_eap")
    @mock.patch("sentry.monitors.utils._fetch_associated_groups_snuba")
    def test_eap_not_called_when_experiment_disabled(
        self,
        mock_snuba: mock.MagicMock,
        mock_eap: mock.MagicMock,
    ) -> None:
        organization = self.create_organization()
        project = self.create_project(organization=organization)
        group = self.create_group(project=project)

        trace_id = uuid4().hex
        mock_snuba.return_value = {group.id: {trace_id}}

        now = datetime.now(tz=timezone.utc)
        result = fetch_associated_groups([trace_id], organization.id, project.id, now, now)

        assert trace_id in result
        result_group_ids = {g["id"] for g in result[trace_id]}
        assert result_group_ids == {group.id}
        mock_snuba.assert_called_once()
        mock_eap.assert_not_called()
