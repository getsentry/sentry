from typing import Any, Mapping, Optional

import pytest
from sentry_kafka_schemas.codecs import Codec, ValidationError

from sentry.sentry_metrics.consumers.indexer.parsed_message import ParsedMessage
from sentry.sentry_metrics.consumers.indexer.processing import INGEST_CODEC
from sentry.sentry_metrics.consumers.indexer.schema_validator import (
    GenericMetricsSchemaValidator,
    ReleaseHealthMetricsSchemaValidator,
)
from sentry.sentry_metrics.use_case_id_registry import UseCaseID
from sentry.testutils.helpers.options import override_options
from sentry.testutils.pytest.fixtures import django_db_all

good_sample_transactions_message: ParsedMessage = ParsedMessage(
    org_id=1,
    project_id=2,
    name="metric_name",
    type="c",
    timestamp=1629360000,
    tags={"tag1": "value1", "tag2": "value2"},
    value=1,
    retention_days=90,
    use_case_id=UseCaseID("transactions"),
)
good_sample_spans_message: ParsedMessage = ParsedMessage(
    org_id=1,
    project_id=2,
    name="metric_name",
    type="c",
    timestamp=1629360000,
    tags={"tag1": "value1", "tag2": "value2"},
    value=1,
    retention_days=90,
    use_case_id=UseCaseID("spans"),
)
bad_sample_transactions_message: ParsedMessage = ParsedMessage(
    org_id=1,
    project_id=2,
    name="metric_name",
    type="c",
    timestamp=1629360000,
    tags={"tag1": "value1", "tag2": "value2"},
    value=1,
    retention_days=90000000,  # this is the bad part
    use_case_id=UseCaseID("transactions"),
)
good_sample_release_health_message: ParsedMessage = ParsedMessage(
    org_id=1,
    project_id=2,
    name="metric_name",
    type="c",
    timestamp=1629360000,
    tags={"tag1": "value1", "tag2": "value2"},
    value=1,
    retention_days=90,
    use_case_id=UseCaseID("sessions"),
)
bad_sample_release_health_message: ParsedMessage = ParsedMessage(
    org_id=1,
    project_id=2,
    name="metric_name",
    type="c",
    timestamp=1629360000,
    tags={"tag1": "value1", "tag2": "value2"},
    value=1,
    retention_days=9000000,  # this is the bad part
    use_case_id=UseCaseID("sessions"),
)


@django_db_all
@pytest.mark.parametrize(
    "codec,option,message,is_valid",
    [
        pytest.param(None, None, good_sample_transactions_message, True, id="no codec"),
        pytest.param(
            INGEST_CODEC, None, good_sample_transactions_message, True, id="no option set"
        ),
        pytest.param(
            INGEST_CODEC,
            {"transactions": 0.0},
            good_sample_transactions_message,
            True,
            id="no validation, good message",
        ),
        pytest.param(
            INGEST_CODEC,
            {"transactions": 0.0},
            bad_sample_transactions_message,
            False,
            id="no validation, bad message",
        ),
        pytest.param(
            INGEST_CODEC,
            {"transactions": 0.0},
            good_sample_spans_message,
            True,
            id="no option on use case, good message",
        ),
        pytest.param(
            INGEST_CODEC,
            {"transactions": 1.0},
            good_sample_transactions_message,
            True,
            id="full validation, good message",
        ),
        pytest.param(
            INGEST_CODEC,
            {"transactions": 1.0},
            bad_sample_transactions_message,
            False,
            id="full validation, bad message",
        ),
    ],
)
def test_generic_metrics_schema_validator(
    codec: Optional[Codec[Any]],
    option: Optional[Mapping],
    message: ParsedMessage,
    is_valid: bool,
) -> None:
    """
    Test the behavior of the GenericMetricsSchemaValidator class with different
    parameters.
    """
    validator = GenericMetricsSchemaValidator(codec)
    with override_options(
        {"sentry-metrics.indexer.generic-metrics.schema-validation-rules": option}
    ):
        if is_valid:
            validator.validate(message)
        else:
            with pytest.raises(ValidationError):
                return validator.validate(message)


def test_release_health_metrics_schema_validator() -> None:
    """
    Test the behavior of the ReleaseHealthMetricsSchemaValidator class.
    We can only get either a ValidationError or None.
    """
    validator = ReleaseHealthMetricsSchemaValidator(INGEST_CODEC)
    validator.validate(good_sample_release_health_message)
    with pytest.raises(ValidationError):
        return validator.validate(bad_sample_release_health_message)
