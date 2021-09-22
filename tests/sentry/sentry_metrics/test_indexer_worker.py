import logging
from datetime import datetime, timezone
from unittest.mock import MagicMock, Mock, patch

import pytest

from sentry.sentry_metrics.indexer.indexer_consumer import MetricsIndexerWorker
from sentry.sentry_metrics.indexer.redis_mock import get_int
from sentry.utils import json

logger = logging.getLogger(__name__)

ts = int(datetime.now(tz=timezone.utc).timestamp())
payload = {
    "name": "session",
    "tags": {
        "environment": "production",
        "release": "sentry-test@1.0.0",
        "session.status": "init",
    },
    "timestamp": ts,
    "type": "c",
    "value": 1.0,
    "org_id": 1,
    "project_id": 3,
}
tests = [
    pytest.param(payload, 0, False, id="success"),
    pytest.param(payload, 1, True, id="missing callback"),
]


@patch("confluent_kafka.Producer")
@pytest.mark.parametrize("metrics_payload, flush_return_value, with_exception", tests)
def test_metrics_indexer_worker(producer, metrics_payload, flush_return_value, with_exception):
    producer.produce = MagicMock()
    producer.flush = MagicMock(return_value=flush_return_value)

    metrics_worker = MetricsIndexerWorker(producer=producer)

    mock_message = Mock()
    mock_message.value = MagicMock(return_value=json.dumps(metrics_payload))

    parsed = metrics_worker.process_message(mock_message)
    assert parsed["tags"] == {get_int(k): get_int(v) for k, v in metrics_payload["tags"].items()}
    assert parsed["metric_id"] == get_int(metrics_payload["name"])

    if with_exception:
        with pytest.raises(Exception, match="didn't get all the callback"):
            metrics_worker.flush_batch([parsed])
    else:
        metrics_worker.flush_batch([parsed])
        producer.produce.assert_called_with(
            topic="snuba-metrics",
            key=None,
            value=json.dumps(parsed).encode(),
            on_delivery=metrics_worker.callback,
        )
