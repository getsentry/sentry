from types import SimpleNamespace
from unittest import mock

from django.conf import settings
from urllib3 import Retry

from sentry.seer.anomaly_detection import store_data_workflow_engine as module
from sentry.snuba.models import SnubaQueryEventType


def _mock_response():
    return SimpleNamespace(status=200, data=b'{"success": true}')


def _historical_data():
    return SimpleNamespace(data={"meta": {"fields": {}}})


def test_send_historical_data_uses_configured_timeout_and_retries(monkeypatch):
    monkeypatch.setattr(module, "get_query_columns", mock.Mock(return_value=["column"]))
    monkeypatch.setattr(
        module, "get_dataset_from_label_and_event_types", mock.Mock(return_value="dataset")
    )
    monkeypatch.setattr(module, "fetch_historical_data", mock.Mock(return_value=_historical_data()))
    monkeypatch.setattr(
        module,
        "format_historical_data",
        mock.Mock(return_value=[{"timestamp": 1, "value": 2.0}]),
    )
    mock_make_signed = mock.Mock(return_value=_mock_response())
    monkeypatch.setattr(module, "make_signed_seer_api_request", mock_make_signed)

    detector = SimpleNamespace(id=1)
    data_source = SimpleNamespace(source_id="42")
    data_condition = SimpleNamespace(
        comparison={"sensitivity": "medium", "threshold_type": 2, "seasonality": "auto"}
    )
    project = SimpleNamespace(id=2, organization=SimpleNamespace(id=3))
    snuba_query = SimpleNamespace(
        aggregate="p99(span.duration)",
        dataset="events_analytics_platform",
        time_window=900,
        event_types=[SnubaQueryEventType.EventType.TRANSACTION],
    )

    module.send_historical_data_to_seer(
        detector=detector,
        data_source=data_source,
        data_condition=data_condition,
        project=project,
        snuba_query=snuba_query,
        event_types=None,
    )

    mock_make_signed.assert_called_once()
    _, kwargs = mock_make_signed.call_args
    assert kwargs["timeout"] == settings.SEER_ANOMALY_DETECTION_STORE_DATA_TIMEOUT
    retries = kwargs["retries"]
    assert isinstance(retries, Retry)
    assert retries.total == settings.SEER_ANOMALY_DETECTION_STORE_DATA_RETRIES
    assert retries.allowed_methods == frozenset({"POST"})
