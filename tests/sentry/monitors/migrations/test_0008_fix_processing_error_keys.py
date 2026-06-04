from typing import Any

import pytest
from django.conf import settings

from sentry.monitors.processing_errors.errors import ProcessingErrorType
from sentry.monitors.processing_errors.manager import (
    build_error_identifier,
    get_errors_for_monitor,
    get_errors_for_projects,
    store_error,
)
from sentry.monitors.testutils import build_checkin_processing_error
from sentry.testutils.cases import TestMigrations
from sentry.utils import json, redis


def _get_cluster() -> Any:
    return redis.redis_clusters.get(settings.SENTRY_MONITORS_REDIS_CLUSTER)


@pytest.mark.skip
class FixProcessingErrorKeysTest(TestMigrations):
    migrate_from = "0007_monitors_json_field"
    migrate_to = "0008_fix_processing_error_keys"
    app = "monitors"
    connection = "secondary"

    def setup_initial_state(self) -> None:
        redis = _get_cluster()
        pipeline = redis.pipeline()

        # monitor error
        self.monitor = self.create_monitor()
        monitor_processing_error = build_checkin_processing_error()
        store_error(monitor_processing_error, self.monitor)

        # replace the UUID
        new_checkin_error_1 = build_checkin_processing_error(
            [{"type": ProcessingErrorType.CHECKIN_INVALID_GUID}],
        )
        new_serialized_checkin_error_1 = json.dumps(new_checkin_error_1.to_dict())

        self.monitor_error_id = monitor_processing_error.id
        monitor_error_key = build_error_identifier(monitor_processing_error.id)
        pipeline.set(monitor_error_key, new_serialized_checkin_error_1)

        # project error
        project_processing_error = build_checkin_processing_error(
            processing_errors=[
                {"type": ProcessingErrorType.MONITOR_NOT_FOUND},
                {"type": ProcessingErrorType.CHECKIN_VALIDATION_FAILED, "errors": {}},
            ],
            message_overrides={"project_id": self.project.id},
        )
        store_error(project_processing_error, None)

        # replace the UUID
        new_checkin_error_2 = build_checkin_processing_error(
            processing_errors=[
                {"type": ProcessingErrorType.MONITOR_NOT_FOUND},
            ],
            message_overrides={"project_id": self.project.id},
        )
        new_serialized_checkin_error_2 = json.dumps(new_checkin_error_2.to_dict())

        self.project_error_id = project_processing_error.id
        project_error_key = build_error_identifier(project_processing_error.id)
        pipeline.set(project_error_key, new_serialized_checkin_error_2)

        pipeline.execute()

        # assert that the IDs are different pre-migration
        project_errors = get_errors_for_projects([self.project])
        monitor_errors = get_errors_for_monitor(self.monitor)
        assert project_errors[0].id != self.project_error_id
        assert monitor_errors[0].id != self.monitor_error_id

    def test(self) -> None:
        monitor_errors = get_errors_for_monitor(self.monitor)
        assert monitor_errors[0].id == self.monitor_error_id

        project_errors = get_errors_for_projects([self.project])
        assert project_errors[0].id == self.project_error_id
