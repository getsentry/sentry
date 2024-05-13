from unittest import mock

from sentry.monitors.processing_errors import (
    CheckinProcessErrorsManager,
    CheckinProcessingError,
    CheckinValidationError,
    ProcessingError,
    ProcessingErrorType,
    handle_processing_errors,
)
from sentry.monitors.testutils import build_checkin_item, build_checkin_processing_error
from sentry.testutils.cases import TestCase


class ProcessingErrorTest(TestCase):
    def test(self):
        error = ProcessingError(ProcessingErrorType.CHECKIN_INVALID_GUID, {"some": "data"})
        recreated_error = ProcessingError.from_dict(error.to_dict())
        assert recreated_error.type == error.type
        assert recreated_error.data == error.data


class CheckinProcessingErrorTest(TestCase):
    def test(self):
        item = build_checkin_item()
        error = CheckinProcessingError(
            [ProcessingError(ProcessingErrorType.MONITOR_DISABLED, {"some": "data"})],
            item,
        )
        recreated_error = CheckinProcessingError.from_dict(error.to_dict())
        assert error == recreated_error


class CheckinProcessErrorsManagerTest(TestCase):
    def test_store_with_monitor(self):
        monitor = self.create_monitor()
        manager = CheckinProcessErrorsManager()
        processing_error = build_checkin_processing_error()
        manager.store(processing_error, monitor)
        fetched_processing_error = manager.get_for_monitor(monitor)
        assert len(fetched_processing_error) == 1
        self.assert_processing_errors_equal(processing_error, fetched_processing_error[0])

    def test_store_with_slug_exists(self):
        monitor = self.create_monitor()
        manager = CheckinProcessErrorsManager()
        processing_error = build_checkin_processing_error(
            message_overrides={"project_id": self.project.id},
            payload_overrides={"monitor_slug": monitor.slug},
        )
        manager.store(processing_error, None)
        fetched_processing_error = manager.get_for_monitor(monitor)
        assert len(fetched_processing_error) == 1
        self.assert_processing_errors_equal(processing_error, fetched_processing_error[0])

    def test_store_with_slug_not_exist(self):
        manager = CheckinProcessErrorsManager()
        processing_error = build_checkin_processing_error(
            message_overrides={"project_id": self.project.id},
            payload_overrides={"monitor_slug": "hi"},
        )

        manager.store(processing_error, None)
        fetched_processing_error = manager.get_for_projects([self.project])
        assert len(fetched_processing_error) == 1
        self.assert_processing_errors_equal(processing_error, fetched_processing_error[0])

    def test_store_max(self):
        monitor = self.create_monitor()
        processing_errors = [
            build_checkin_processing_error(
                [ProcessingError(ProcessingErrorType.CHECKIN_INVALID_GUID, {"guid": "bad"})],
                message_overrides={"project_id": self.project.id},
                payload_overrides={"monitor_slug": monitor.slug},
            ),
            build_checkin_processing_error(
                [ProcessingError(ProcessingErrorType.MONITOR_DISABLED, {"some": "data"})],
                message_overrides={"project_id": self.project.id},
                payload_overrides={"monitor_slug": monitor.slug},
            ),
            build_checkin_processing_error(
                [ProcessingError(ProcessingErrorType.ORGANIZATION_KILLSWITCH_ENABLED)],
                message_overrides={"project_id": self.project.id},
                payload_overrides={"monitor_slug": monitor.slug},
            ),
        ]
        manager = CheckinProcessErrorsManager()
        with mock.patch("sentry.monitors.processing_errors.MAX_ERRORS_PER_SET", new=2):
            for error in processing_errors:
                manager.store(error, monitor)

        retrieved_errors = manager.get_for_monitor(monitor)
        assert len(retrieved_errors) == 2
        self.assert_processing_errors_equal(processing_errors[2], retrieved_errors[0])
        self.assert_processing_errors_equal(processing_errors[1], retrieved_errors[1])

    def assert_processing_errors_equal(
        self, error_1: CheckinProcessingError, error_2: CheckinProcessingError
    ):
        assert error_1.errors == error_2.errors
        assert error_2.checkin == error_2.checkin

    def test_get_for_monitor_empty(self):
        manager = CheckinProcessErrorsManager()
        monitor = self.create_monitor()
        assert len(manager.get_for_monitor(monitor)) == 0

    def test_get_for_project(self):
        manager = CheckinProcessErrorsManager()
        assert len(manager.get_for_projects([self.project])) == 0

    def test_get_missing_data(self):
        # Validate that we don't error if a processing error has expired but is still
        # in the set
        monitor = self.create_monitor()
        manager = CheckinProcessErrorsManager()
        processing_errors = [
            build_checkin_processing_error(
                [ProcessingError(ProcessingErrorType.CHECKIN_INVALID_GUID, {"guid": "bad"})],
                message_overrides={"project_id": self.project.id},
                payload_overrides={"monitor_slug": monitor.slug},
            ),
            build_checkin_processing_error(
                [ProcessingError(ProcessingErrorType.MONITOR_DISABLED, {"some": "data"})],
                message_overrides={"project_id": self.project.id},
                payload_overrides={"monitor_slug": monitor.slug},
            ),
        ]
        for processing_error in processing_errors:
            manager.store(processing_error, monitor)
        redis = manager._get_cluster()
        redis.delete(
            manager.build_error_identifier(
                manager.build_monitor_identifier(monitor), processing_errors[0].id
            )
        )
        fetched_processing_error = manager.get_for_monitor(monitor)
        assert len(fetched_processing_error) == 1
        self.assert_processing_errors_equal(processing_errors[1], fetched_processing_error[0])


class HandleProcessingErrorsTest(TestCase):
    def test(self):
        monitor = self.create_monitor()
        exception = CheckinValidationError(
            [ProcessingError(ProcessingErrorType.CHECKIN_INVALID_GUID, {"guid": "bad"})],
            monitor=monitor,
        )
        handle_processing_errors(
            build_checkin_item(
                message_overrides={"project_id": self.project.id},
            ),
            exception,
        )
        manager = CheckinProcessErrorsManager()
        errors = manager.get_for_monitor(monitor)
        assert not errors
        with self.feature("organizations:crons-write-user-feedback"):
            handle_processing_errors(
                build_checkin_item(
                    message_overrides={"project_id": self.project.id},
                ),
                exception,
            )
        errors = manager.get_for_monitor(monitor)
        assert len(errors) == 1
