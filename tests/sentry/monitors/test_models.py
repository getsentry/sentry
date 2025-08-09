from unittest import mock

import pytest

from sentry.monitors.models import CronMonitorDataSourceHandler, Monitor
from sentry.monitors.types import DATA_SOURCE_CRON_MONITOR
from sentry.testutils.cases import TestCase
from sentry.workflow_engine.models import DataSource


class CronMonitorDataSourceHandlerTest(TestCase):
    def setUp(self):
        super().setUp()
        self.monitor = self.create_monitor(
            project=self.project,
            name="Test Monitor",
        )

        self.data_source = DataSource.objects.create(
            type=DATA_SOURCE_CRON_MONITOR,
            source_id=str(self.monitor.id),
            organization_id=self.organization.id,
        )

    def test_bulk_get_query_object(self):
        result = CronMonitorDataSourceHandler.bulk_get_query_object([self.data_source])
        assert result[self.data_source.id] == self.monitor

    def test_bulk_get_query_object__multiple_monitors(self):
        monitor2 = self.create_monitor(
            project=self.project,
            name="Test Monitor 2",
        )
        data_source2 = DataSource.objects.create(
            type=DATA_SOURCE_CRON_MONITOR,
            source_id=str(monitor2.id),
            organization_id=self.organization.id,
        )

        data_sources = [self.data_source, data_source2]
        result = CronMonitorDataSourceHandler.bulk_get_query_object(data_sources)

        assert result[self.data_source.id] == self.monitor
        assert result[data_source2.id] == monitor2

    def test_bulk_get_query_object__incorrect_data_source(self):
        ds_with_invalid_monitor_id = DataSource.objects.create(
            type=DATA_SOURCE_CRON_MONITOR,
            source_id="not_an_int",
            organization_id=self.organization.id,
        )

        with mock.patch("sentry.monitors.models.logger.exception") as mock_logger:
            data_sources = [self.data_source, ds_with_invalid_monitor_id]
            result = CronMonitorDataSourceHandler.bulk_get_query_object(data_sources)

            assert result[self.data_source.id] == self.monitor
            assert result[ds_with_invalid_monitor_id.id] is None

            mock_logger.assert_called_once_with(
                "Invalid DataSource.source_id fetching Monitor",
                extra={
                    "id": ds_with_invalid_monitor_id.id,
                    "source_id": ds_with_invalid_monitor_id.source_id,
                },
            )

    def test_bulk_get_query_object__missing_monitor(self):
        ds_with_deleted_monitor = DataSource.objects.create(
            type=DATA_SOURCE_CRON_MONITOR,
            source_id="99999999",
            organization_id=self.organization.id,
        )

        data_sources = [self.data_source, ds_with_deleted_monitor]
        result = CronMonitorDataSourceHandler.bulk_get_query_object(data_sources)

        assert result[self.data_source.id] == self.monitor
        assert result[ds_with_deleted_monitor.id] is None

    def test_bulk_get_query_object__empty_list(self):
        result = CronMonitorDataSourceHandler.bulk_get_query_object([])
        assert result == {}

    def test_related_model(self):
        relations = CronMonitorDataSourceHandler.related_model(self.data_source)
        assert len(relations) == 1
        relation = relations[0]

        assert relation.params["model"] == Monitor
        assert relation.params["query"] == {"id": self.data_source.source_id}

    def test_get_instance_limit(self):
        assert CronMonitorDataSourceHandler.get_instance_limit(self.organization) is None

    def test_get_current_instance_count(self):
        with pytest.raises(NotImplementedError):
            CronMonitorDataSourceHandler.get_current_instance_count(self.organization)
