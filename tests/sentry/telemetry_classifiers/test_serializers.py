from typing import get_args

from sentry.telemetry_classifiers.serializers import DatasetValue, OutputTypeValue, StatusValue
from sentry.telemetry_classifiers.types import (
    Dataset,
    TelemetryClassifierOutputType,
    TelemetryClassifierStatus,
)


def test_response_literals_match_model_choices() -> None:
    assert set(get_args(DatasetValue)) == set(Dataset.values)
    assert set(get_args(StatusValue)) == set(TelemetryClassifierStatus.values)
    assert set(get_args(OutputTypeValue)) == set(TelemetryClassifierOutputType.values)
