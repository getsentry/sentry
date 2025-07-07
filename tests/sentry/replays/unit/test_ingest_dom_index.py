import uuid
from unittest import mock

import pytest

from sentry.replays.usecases.ingest.event_logger import emit_click_events
from sentry.replays.usecases.ingest.event_parser import ClickEvent
from sentry.utils import json


@pytest.mark.parametrize(
    "test_environment,expected_environment",
    [
        ("production", "production"),
        ("dev", "dev"),
        ("", ""),
        (None, ""),
    ],
)
def test_emit_click_events_environment_handling(test_environment, expected_environment):
    click_events = [
        ClickEvent(
            timestamp=1,
            node_id=1,
            tag="div",
            text="test",
            is_dead=False,
            is_rage=False,
            url="http://example.com",
            selector="div",
            component_name="SignUpForm",
            alt="1",
            aria_label="test",
            classes=["class1", "class2"],
            id="id",
            role="button",
            testid="2",
            title="3",
        )
    ]

    with mock.patch(
        "sentry.replays.usecases.ingest.event_logger._initialize_publisher"
    ) as mock_init_publisher:
        mock_publisher = mock.MagicMock()
        mock_init_publisher.return_value = mock_publisher

        emit_click_events(
            click_events=click_events,
            project_id=1,
            replay_id=uuid.uuid4().hex,
            retention_days=30,
            start_time=1,
            environment=test_environment,
        )

        call_args = mock_publisher.publish.call_args
        assert call_args is not None

        channel, data = call_args.args
        action = json.loads(data)
        payload = json.loads(bytes(action["payload"]))
        assert payload["environment"] == expected_environment
