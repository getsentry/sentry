from unittest.mock import patch

import msgspec

from sentry.scm.private.ipc import (
    CheckRunEventDataParser,
    CheckRunEventParser,
    SubscriptionEventParser,
    produce_to_listener,
    run_webhook_handler_control_task,
    run_webhook_handler_region_task,
)
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers import TaskRunner
from sentry.testutils.silo import cell_silo_test, control_silo_test


def _valid_check_run_message() -> str:
    event = CheckRunEventParser(
        action="completed",
        check_run=CheckRunEventDataParser("1", "2"),
        subscription_event=SubscriptionEventParser(None, "", {}, 0, [], "github"),
    )
    return msgspec.json.encode(event).decode("utf-8")


class TestProduceToListenerIntegration(TestCase):
    def test_produce_to_listener_control_silo(self) -> None:
        """Test that produce_to_listener calls control silo task delay correctly."""
        with patch(
            "sentry.scm.private.ipc.run_webhook_handler_control_task.delay"
        ) as mock_control_delay:
            produce_to_listener("", "check_run", "test_listener", "control")
            mock_control_delay.assert_called_once_with("test_listener", "", "check_run")

    def test_produce_to_listener_region_silo(self) -> None:
        """Test that produce_to_listener calls region silo task delay correctly."""
        with patch(
            "sentry.scm.private.ipc.run_webhook_handler_region_task.delay"
        ) as mock_region_delay:
            produce_to_listener("", "check_run", "my_handler", "region")
            mock_region_delay.assert_called_once_with("my_handler", "", "check_run")


@control_silo_test
class TestWebhookHandlerControlTaskIntegration(TestCase):
    def test_run_webhook_handler_control_task_success(self) -> None:
        """Test the task can be delayed without error."""
        with TaskRunner():
            run_webhook_handler_control_task.delay(
                "anything", _valid_check_run_message(), "check_run"
            )


@cell_silo_test
class TestWebhookHandlerRegionTaskIntegration(TestCase):
    def test_run_webhook_handler_region_task_success(self) -> None:
        """Test the task can be delayed without error."""
        with TaskRunner():
            run_webhook_handler_region_task.delay(
                "anything", _valid_check_run_message(), "check_run"
            )
