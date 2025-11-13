from unittest import mock

import pytest

from sentry.backup.dependencies import ImportKind, NormalizedModelName, PrimaryKeyMap
from sentry.backup.helpers import ImportFlags
from sentry.backup.scopes import ImportScope
from sentry.monitors.types import DATA_SOURCE_CRON_MONITOR
from sentry.workflow_engine.registry import data_source_type_registry
from tests.sentry.workflow_engine.test_base import BaseWorkflowTest


class DataSourceTest(BaseWorkflowTest):
    def test_invalid_data_source_type(self) -> None:
        with pytest.raises(ValueError):
            self.create_data_source(type="invalid_type")

    def test_data_source_valid_type(self) -> None:
        # Make sure the mock was registered in test_base
        assert isinstance(data_source_type_registry.get("test"), mock.Mock)

        data_source = self.create_data_source(type="test")
        assert data_source is not None
        assert data_source.type == "test"

    def test_normalize_before_relocation_import(self) -> None:
        monitor = self.create_monitor(project=self.project)
        data_source = self.create_data_source(
            type=DATA_SOURCE_CRON_MONITOR,
            source_id=str(monitor.id),
            organization_id=self.organization.id,
        )

        old_monitor_pk = monitor.id
        new_monitor_pk = 9999
        old_data_source_id = data_source.id
        old_org_id = data_source.organization_id

        # Create a PrimaryKeyMap that maps the old monitor ID to a new one
        pk_map = PrimaryKeyMap()
        pk_map.insert(
            model_name=NormalizedModelName("monitors.monitor"),
            old=old_monitor_pk,
            new=new_monitor_pk,
            kind=ImportKind.Inserted,
        )
        pk_map.insert(
            model_name=NormalizedModelName("sentry.organization"),
            old=old_org_id,
            new=old_org_id,
            kind=ImportKind.Inserted,
        )

        old_data_source_pk = data_source.normalize_before_relocation_import(
            pk_map, ImportScope.Organization, ImportFlags()
        )

        assert (
            old_data_source_pk == old_data_source_id
        ), f"Expected {old_data_source_id}, got {old_data_source_pk}"
        assert data_source.source_id == str(new_monitor_pk)
        assert data_source.pk is None

    def test_normalize_before_relocation_import_missing_source(self) -> None:
        monitor = self.create_monitor(project=self.project)
        data_source = self.create_data_source(
            type=DATA_SOURCE_CRON_MONITOR,
            source_id=str(monitor.id),
            organization_id=self.organization.id,
        )

        old_org_id = data_source.organization_id

        # Create a PrimaryKeyMap without the monitor mapping
        pk_map = PrimaryKeyMap()
        pk_map.insert(
            model_name=NormalizedModelName("sentry.organization"),
            old=old_org_id,
            new=old_org_id,
            kind=ImportKind.Inserted,
        )

        result = data_source.normalize_before_relocation_import(
            pk_map, ImportScope.Organization, ImportFlags()
        )

        # Should return None when the referenced source is not in pk_map
        assert result is None
