from unittest.mock import patch

import msgspec

from sentry.scm.private.event_stream import SourceCodeManagerEventStream
from sentry.scm.private.ipc import (
    CheckRunEventDataParser,
    CheckRunEventParser,
    SubscriptionEventParser,
    produce_to_listener,
    run_webhook_handler_control_task,
    run_webhook_handler_region_task,
)
from sentry.scm.types import CheckRunEvent
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers import TaskRunner
from sentry.testutils.silo import control_silo_test, region_silo_test


class TestProduceToListenerIntegration(TestCase):
    """
    Integration tests for produce_to_listener function that queues Celery tasks.
    """

    def test_produce_to_listener_control_silo(self):
        """
        Test that produce_to_listener calls control silo task delay correctly.
        """
        with patch(
            "sentry.scm.private.ipc.run_webhook_handler_control_task.delay"
        ) as mock_control_delay:
            produce_to_listener("", "check_run", "test_listener", "control")
            mock_control_delay.assert_called_once_with("test_listener", b"", "check_run")

    def test_produce_to_listener_region_silo(self):
        """
        Test that produce_to_listener calls region silo task delay correctly.
        """
        with patch(
            "sentry.scm.private.ipc.run_webhook_handler_region_task.delay"
        ) as mock_region_delay:
            produce_to_listener("", "check_run", "my_handler", "region")
            mock_region_delay.assert_called_once_with("my_handler", b"", "check_run")


@control_silo_test
class TestWebhookHandlerControlTaskIntegration(TestCase):
    """
    Integration tests for the control silo Celery task handler.
    """

    def test_run_webhook_handler_control_task_success(self):
        """
        Test that control task successfully executes a registered listener.
        """
        executed_event = None

        scm = SourceCodeManagerEventStream()

        @scm.listen_for("check_run")
        def control_listener(event):
            nonlocal executed_event
            executed_event = event

        check_run_event = CheckRunEventParser(
            action="completed",
            check_run=CheckRunEventDataParser("ext-789", "https://example.com/check3"),
            subscription_event=SubscriptionEventParser(
                "check_run", b"raw_event", {}, 300, None, "github"
            ),
        )
        message = msgspec.json.encode(check_run_event).decode("utf-8")

        # Mock the global scm_event_stream
        import sentry.scm.private.ipc as ipc_module

        original_stream = ipc_module.scm_event_stream
        ipc_module.scm_event_stream = scm

        try:
            with TaskRunner():
                run_webhook_handler_control_task.delay("control_listener", message, "check_run")

            assert executed_event is not None
            assert isinstance(executed_event, CheckRunEvent)
            assert executed_event.action == "completed"
            assert executed_event.check_run["external_id"] == "ext-789"
        finally:
            ipc_module.scm_event_stream = original_stream


@region_silo_test
class TestWebhookHandlerRegionTaskIntegration(TestCase):
    """
    Integration tests for the region silo Celery task handler.
    """

    def test_run_webhook_handler_region_task_success(self):
        """
        Test that region task successfully executes a registered listener.
        """
        executed_events = []

        scm = SourceCodeManagerEventStream()

        @scm.listen_for("check_run")
        def region_listener(event):
            executed_events.append(event)

        # Verify listener was registered
        assert "region_listener" in scm.check_run_listeners

        check_run_event = CheckRunEventParser(
            action="completed",
            check_run=CheckRunEventDataParser("ext-999", "https://example.com/check4"),
            subscription_event=SubscriptionEventParser(
                "check_run", b"data", {}, 400, None, "github"
            ),
        )
        message = msgspec.json.encode(check_run_event).decode("utf-8")

        # Mock the global scm_event_stream
        import sentry.scm.private.ipc as ipc_module

        original_stream = ipc_module.scm_event_stream
        ipc_module.scm_event_stream = scm

        try:
            # Verify the mock worked
            assert ipc_module.scm_event_stream is scm
            assert "region_listener" in ipc_module.scm_event_stream.check_run_listeners

            with TaskRunner():
                run_webhook_handler_region_task.delay("region_listener", message, "check_run")

            assert len(executed_events) == 1, f"Expected 1 event but got {len(executed_events)}"
            executed_event = executed_events[0]
            assert isinstance(executed_event, CheckRunEvent)
            assert executed_event.action == "requested"
            assert executed_event.check_run["external_id"] == "ext-999"
        finally:
            ipc_module.scm_event_stream = original_stream
