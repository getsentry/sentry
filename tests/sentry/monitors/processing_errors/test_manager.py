from unittest import mock

from sentry.monitors.processing_errors.errors import (
    CheckinProcessingError,
    ProcessingErrorsException,
    ProcessingErrorType,
)
from sentry.monitors.processing_errors.manager import (
    _get_cluster,
    build_error_identifier,
    delete_error,
    delete_errors_for_monitor_by_type,
    delete_errors_for_project_by_type,
    get_errors_for_monitor,
    get_errors_for_projects,
    handle_processing_errors,
    store_error,
)
from sentry.monitors.testutils import build_checkin_item, build_checkin_processing_error
from sentry.testutils.cases import TestCase


def assert_processing_errors_equal(
    error_1: CheckinProcessingError,
    error_2: CheckinProcessingError,
):
    assert error_1.errors == error_2.errors
    assert error_2.checkin == error_2.checkin


class CheckinProcessErrorsManagerTest(TestCase):
    def test_store_with_monitor(self):
        monitor = self.create_monitor()
        processing_error = build_checkin_processing_error()
        store_error(processing_error, monitor)
        fetched_processing_error = get_errors_for_monitor(monitor)
        assert len(fetched_processing_error) == 1
        assert_processing_errors_equal(processing_error, fetched_processing_error[0])

    def test_store_with_slug_exists(self):
        monitor = self.create_monitor()
        processing_error = build_checkin_processing_error(
            message_overrides={"project_id": self.project.id},
            payload_overrides={"monitor_slug": monitor.slug},
        )
        store_error(processing_error, None)
        fetched_processing_error = get_errors_for_monitor(monitor)
        assert len(fetched_processing_error) == 1
        assert_processing_errors_equal(processing_error, fetched_processing_error[0])

    def test_store_with_slug_not_exist(self):
        processing_error = build_checkin_processing_error(
            message_overrides={"project_id": self.project.id},
            payload_overrides={"monitor_slug": "hi"},
        )

        store_error(processing_error, None)
        fetched_processing_error = get_errors_for_projects([self.project])
        assert len(fetched_processing_error) == 1
        assert_processing_errors_equal(processing_error, fetched_processing_error[0])

    def test_store_max(self):
        monitor = self.create_monitor()
        processing_errors = [
            build_checkin_processing_error(
                [{"type": ProcessingErrorType.CHECKIN_INVALID_GUID}],
                message_overrides={"project_id": self.project.id},
                payload_overrides={"monitor_slug": monitor.slug},
            ),
            build_checkin_processing_error(
                [{"type": ProcessingErrorType.MONITOR_DISABLED_NO_QUOTA}],
                message_overrides={"project_id": self.project.id},
                payload_overrides={"monitor_slug": monitor.slug},
            ),
            build_checkin_processing_error(
                [{"type": ProcessingErrorType.MONITOR_DISABLED}],
                message_overrides={"project_id": self.project.id},
                payload_overrides={"monitor_slug": monitor.slug},
            ),
            build_checkin_processing_error(
                [{"type": ProcessingErrorType.ORGANIZATION_KILLSWITCH_ENABLED}],
                message_overrides={"project_id": self.project.id},
                payload_overrides={"monitor_slug": monitor.slug},
            ),
        ]
        for error in processing_errors[:3]:
            store_error(error, monitor)

        with mock.patch("sentry.monitors.processing_errors.manager.MAX_ERRORS_PER_SET", new=2):
            store_error(processing_errors[-1], monitor)

        retrieved_errors = get_errors_for_monitor(monitor)
        assert len(retrieved_errors) == 2
        assert_processing_errors_equal(processing_errors[-1], retrieved_errors[0])
        assert_processing_errors_equal(processing_errors[-2], retrieved_errors[1])
        redis_client = _get_cluster()
        assert not redis_client.exists(build_error_identifier(processing_errors[0].id))
        assert not redis_client.exists(build_error_identifier(processing_errors[1].id))
        assert redis_client.exists(build_error_identifier(processing_errors[2].id))
        assert redis_client.exists(build_error_identifier(processing_errors[3].id))

    def test_get_for_monitor_empty(self):
        monitor = self.create_monitor()
        assert len(get_errors_for_monitor(monitor)) == 0

    def test_get_for_project(self):
        assert len(get_errors_for_projects([self.project])) == 0

    def test_get_missing_data(self):
        # Validate that we don't error if a processing error has expired but is still
        # in the set
        monitor = self.create_monitor()
        processing_errors = [
            build_checkin_processing_error(
                [{"type": ProcessingErrorType.CHECKIN_INVALID_GUID}],
                message_overrides={"project_id": self.project.id},
                payload_overrides={"monitor_slug": monitor.slug},
            ),
            build_checkin_processing_error(
                [{"type": ProcessingErrorType.MONITOR_DISABLED}],
                message_overrides={"project_id": self.project.id},
                payload_overrides={"monitor_slug": monitor.slug},
            ),
        ]
        for processing_error in processing_errors:
            store_error(processing_error, monitor)
        redis = _get_cluster()
        redis.delete(build_error_identifier(processing_errors[0].id))
        fetched_processing_error = get_errors_for_monitor(monitor)
        assert len(fetched_processing_error) == 1
        assert_processing_errors_equal(processing_errors[1], fetched_processing_error[0])

    def test_delete_for_monitor(self):
        monitor = self.create_monitor()
        processing_error = build_checkin_processing_error(
            message_overrides={"project_id": self.project.id},
            payload_overrides={"monitor_slug": monitor.slug},
        )
        store_error(processing_error, monitor)
        assert len(get_errors_for_monitor(monitor)) == 1
        delete_error(self.project, processing_error.id)
        assert len(get_errors_for_monitor(monitor)) == 0

    def test_delete_for_project(self):
        processing_error = build_checkin_processing_error(
            message_overrides={"project_id": self.project.id},
        )
        store_error(processing_error, None)
        assert len(get_errors_for_projects([self.project])) == 1
        delete_error(self.project, processing_error.id)
        assert len(get_errors_for_projects([self.project])) == 0

    def test_delete_for_monitor_by_type(self):
        monitor = self.create_monitor()
        processing_error1 = build_checkin_processing_error(
            processing_errors=[{"type": ProcessingErrorType.CHECKIN_FINISHED}],
            message_overrides={"project_id": self.project.id},
            payload_overrides={"monitor_slug": monitor.slug},
        )
        processing_error2 = build_checkin_processing_error(
            processing_errors=[{"type": ProcessingErrorType.CHECKIN_FINISHED}],
            message_overrides={"project_id": self.project.id},
            payload_overrides={"monitor_slug": monitor.slug},
        )
        store_error(processing_error1, monitor)
        store_error(processing_error2, monitor)

        processing_error3 = build_checkin_processing_error(
            processing_errors=[
                {"type": ProcessingErrorType.CHECKIN_FINISHED},
                {"type": ProcessingErrorType.MONITOR_DISABLED},
            ],
            message_overrides={"project_id": self.project.id},
            payload_overrides={"monitor_slug": monitor.slug},
        )
        store_error(processing_error3, monitor)

        # verify that we have stored three checkin processing errors
        assert len(get_errors_for_monitor(monitor)) == 3
        delete_errors_for_monitor_by_type(monitor, ProcessingErrorType.CHECKIN_FINISHED)

        # after deleting we should be left with a single MONITOR_DISABLED error
        monitor_errors = get_errors_for_monitor(monitor)
        assert len(monitor_errors) == 1
        assert len(monitor_errors[0].errors) == 1
        assert monitor_errors[0].errors[0]["type"] == ProcessingErrorType.MONITOR_DISABLED

    def test_delete_for_project_by_type(self):
        processing_error1 = build_checkin_processing_error(
            processing_errors=[{"type": ProcessingErrorType.MONITOR_NOT_FOUND}],
            message_overrides={"project_id": self.project.id},
        )
        processing_error2 = build_checkin_processing_error(
            processing_errors=[{"type": ProcessingErrorType.MONITOR_NOT_FOUND}],
            message_overrides={"project_id": self.project.id},
        )
        store_error(processing_error1, None)
        store_error(processing_error2, None)

        processing_error3 = build_checkin_processing_error(
            processing_errors=[
                {"type": ProcessingErrorType.MONITOR_NOT_FOUND},
                {"type": ProcessingErrorType.CHECKIN_VALIDATION_FAILED, "errors": {}},
            ],
            message_overrides={"project_id": self.project.id},
        )
        store_error(processing_error3, None)

        # verify that we have stored three checkin processing errors
        assert len(get_errors_for_projects([self.project])) == 3
        delete_errors_for_project_by_type(self.project, ProcessingErrorType.MONITOR_NOT_FOUND)

        # after deleting we should be left with a single CHECKIN_VALIDATION_FAILED error
        project_errors = get_errors_for_projects([self.project])
        assert len(project_errors) == 1
        assert len(project_errors[0].errors) == 1
        assert project_errors[0].errors[0]["type"] == ProcessingErrorType.CHECKIN_VALIDATION_FAILED


class HandleProcessingErrorsTest(TestCase):
    @mock.patch("sentry.monitors.processing_errors.manager.ANALYTICS_SAMPLING_RATE", 1.0)
    @mock.patch("sentry.analytics.record")
    def test(self, mock_record):
        monitor = self.create_monitor()
        exception = ProcessingErrorsException(
            [{"type": ProcessingErrorType.CHECKIN_INVALID_GUID}],
            monitor=monitor,
        )
        handle_processing_errors(
            build_checkin_item(
                message_overrides={"project_id": self.project.id},
                payload_overrides={"monitor_slug": monitor.slug},
            ),
            exception,
        )
        errors = get_errors_for_monitor(monitor)
        assert len(errors) == 1

        mock_record.assert_called_with(
            "checkin_processing_error.stored",
            organization_id=self.organization.id,
            project_id=self.project.id,
            monitor_slug=monitor.slug,
            error_types=[ProcessingErrorType.CHECKIN_INVALID_GUID],
        )
