from typing import Any, Mapping, Optional
from unittest import mock

import pytest
from sentry_kafka_schemas.codecs import Codec, ValidationError
from sentry_kafka_schemas.schema_types.ingest_metrics_v1 import IngestMetric

from sentry.sentry_metrics.consumers.indexer.parsed_message import ParsedMessage
from sentry.sentry_metrics.consumers.indexer.processing import INGEST_CODEC
from sentry.sentry_metrics.consumers.indexer.schema_validator import (
    GenericMetricsSchemaValidator,
    ReleaseHealthMetricsSchemaValidator,
)

test_message: IngestMetric = IngestMetric(
    org_id=1,
    project_id=2,
    name="metric_name",
    type="c",
    timestamp=1629360000,
    tags={"tag1": "value1", "tag2": "value2"},
    value=1,
    retention_days=90,
)
good_sample_transactions_message: ParsedMessage = ParsedMessage(
    use_case_id="transactions",
    **test_message,
)
good_sample_spans_message: ParsedMessage = ParsedMessage(
    use_case_id="spans",
    **test_message,
)
bad_sample_transactions_message: ParsedMessage = ParsedMessage(
    use_case_id="transactions",
    org_id=1,
    project_id=2,
    name="metric_name",
    type="unknown_type",  # this is the bad part
    timestamp=1629360000,
    tags={"tag1": "value1", "tag2": "value2"},
    value=1,
    retention_days=90,
)
good_sample_release_health_message: ParsedMessage = ParsedMessage(
    use_case_id="release_health",
    **test_message,
)
bad_sample_release_health_message: ParsedMessage = ParsedMessage(
    use_case_id="release_health",
    org_id=1,
    project_id=2,
    name="metric_name",
    type="unknown_type",  # this is the bad part
    timestamp=1629360000,
    tags={"tag1": "value1", "tag2": "value2"},
    value=1,
    retention_days=90,
)


@pytest.mark.django_db
@pytest.mark.parametrize(
    "codec,option,message,expected_result",
    [
        pytest.param(None, None, good_sample_transactions_message, None, id="no codec"),
        pytest.param(
            INGEST_CODEC, None, good_sample_transactions_message, None, id="no option set"
        ),
        pytest.param(
            INGEST_CODEC,
            {"transactions": 0.0},
            good_sample_transactions_message,
            None,
            id="no validation, good message",
        ),
        pytest.param(
            INGEST_CODEC,
            {"transactions": 0.0},
            bad_sample_transactions_message,
            ValidationError,
            id="no validation, bad message",
        ),
        pytest.param(
            INGEST_CODEC,
            {"transactions": 0.0},
            good_sample_spans_message,
            None,
            id="no option on use case, good message",
        ),
        pytest.param(
            INGEST_CODEC,
            {"transactions": 1.0},
            good_sample_transactions_message,
            None,
            id="full validation, good message",
        ),
        pytest.param(
            INGEST_CODEC,
            {"transactions": 1.0},
            bad_sample_transactions_message,
            ValidationError,
            id="full validation, bad message",
        ),
    ],
)
def test_generic_metrics_schema_validator(
    codec: Optional[Codec[Any]],
    option: Optional[Mapping],
    message: ParsedMessage,
    expected_result: Optional[ValidationError],
) -> None:
    validator = GenericMetricsSchemaValidator(codec)
    with mock.patch(
        "sentry.sentry_metrics.consumers.indexer.schema_validator.options.get", return_value=option
    ):
        if expected_result:
            with pytest.raises(expected_result):
                validator.validate(message)
        else:
            assert validator.validate(message) == expected_result


def test_release_health_metrics_schema_validator() -> None:
    validator = ReleaseHealthMetricsSchemaValidator(INGEST_CODEC)
    assert validator.validate(good_sample_release_health_message) is None
    with pytest.raises(ValidationError):
        validator.validate(bad_sample_release_health_message)
