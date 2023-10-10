from unittest.mock import Mock

import pytest
from arroyo.backends.kafka import KafkaPayload
from arroyo.types import Message, Value

from sentry.consumers.validate_schema import ValidateSchema
from sentry.utils import json


def make_message(value: object) -> Message[KafkaPayload]:
    return Message(Value(KafkaPayload(None, json.dumps(value).encode("utf-8"), []), {}))


valid = make_message(
    {
        "org_id": 420,
        "project_id": 420,
        "name": "c:sessions/session@none",
        "tags": {
            "sdk": "raven-node/2.6.3",
            "environment": "production",
            "release": "sentry-test@1.0.0",
            "session.status": "init",
        },
        "timestamp": 1111111111111111,
        "retention_days": 90,
        "type": "c",
        "value": 1,
    }
)

invalid = make_message(
    {
        "org_id": 420,
    }
)


def test_validate_schema_with_enforcement() -> None:
    next_step = Mock()
    strategy = ValidateSchema("ingest-metrics", True, next_step)
    strategy.submit(valid)
    assert next_step.submit.call_args[0][0] == valid

    with pytest.raises(Exception):
        strategy.submit(invalid)


def test_validate_schema_without_enforcement() -> None:
    next_step = Mock()
    strategy = ValidateSchema("ingest-metrics", False, next_step)
    strategy.submit(valid)
    assert next_step.submit.call_args[0][0] == valid

    # Does not raise
    strategy.submit(invalid)
    assert next_step.submit.call_args[0][0] == invalid
