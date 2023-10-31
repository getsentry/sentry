from typing import Any, Mapping, Optional

import pytest
from sentry_kafka_schemas.codecs import Codec, ValidationError

from sentry.sentry_metrics.consumers.indexer.parsed_message import ParsedMessage
from sentry.sentry_metrics.consumers.indexer.processing import INGEST_CODEC
from sentry.sentry_metrics.consumers.indexer.schema_validator import MetricsSchemaValidator
from sentry.sentry_metrics.use_case_id_registry import UseCaseID
from sentry.testutils.helpers.options import override_options
from sentry.testutils.pytest.fixtures import django_db_all

__GENERIC_METRICS_OPTION_NAME = "sentry-metrics.indexer.generic-metrics.schema-validation-rules"
__RELEASE_HEALTH_METRICS_OPTION_NAME = (
    "sentry-metrics.indexer.release-health.schema-validation-rules"
)

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
bad_sample_spans_message: ParsedMessage = ParsedMessage(
    org_id=1,
    project_id=2,
    name="metric_name",
    type="c",
    timestamp=1629360000,
    tags={"tag1": "value1", "tag2": "value2"},
    value=1,
    retention_days=900000,  # this is the bad part
    use_case_id=UseCaseID("spans"),
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
    "codec,option_name,option_value,message,is_valid",
    [
        pytest.param(None, None, None, good_sample_transactions_message, True, id="no codec"),
        pytest.param(
            INGEST_CODEC, None, None, good_sample_transactions_message, True, id="no option set"
        ),
        pytest.param(
            INGEST_CODEC,
            __GENERIC_METRICS_OPTION_NAME,
            {},
            good_sample_transactions_message,
            True,
            id="empty option on good message should pass",
        ),
        pytest.param(
            INGEST_CODEC,
            __GENERIC_METRICS_OPTION_NAME,
            {},
            bad_sample_transactions_message,
            False,
            id="empty option on bad message should fail",
        ),
        pytest.param(
            INGEST_CODEC,
            __GENERIC_METRICS_OPTION_NAME,
            {"transactions": 0.0},
            good_sample_transactions_message,
            True,
            id="no sampling on good message should pass",
        ),
        pytest.param(
            INGEST_CODEC,
            __GENERIC_METRICS_OPTION_NAME,
            {"transactions": 0.0},
            bad_sample_transactions_message,
            True,
            id="no sampling on bad message should pass",
        ),
        pytest.param(
            INGEST_CODEC,
            __GENERIC_METRICS_OPTION_NAME,
            {"transactions": 0.0},
            good_sample_spans_message,
            True,
            id="no sampling on good spans message should pass",
        ),
        pytest.param(
            INGEST_CODEC,
            __GENERIC_METRICS_OPTION_NAME,
            {"transactions": 0.0},
            bad_sample_spans_message,
            False,
            id="no sampling on bad spans message should fail",
        ),
        pytest.param(
            INGEST_CODEC,
            __GENERIC_METRICS_OPTION_NAME,
            {"transactions": 1.0},
            good_sample_transactions_message,
            True,
            id="full sampling on good message should pass",
        ),
        pytest.param(
            INGEST_CODEC,
            __GENERIC_METRICS_OPTION_NAME,
            {"transactions": 1.0},
            bad_sample_transactions_message,
            False,
            id="full sampling on bad message should fail",
        ),
        pytest.param(
            INGEST_CODEC,
            __RELEASE_HEALTH_METRICS_OPTION_NAME,
            {},
            good_sample_release_health_message,
            True,
            id="release health empty option on good message should pass",
        ),
        pytest.param(
            INGEST_CODEC,
            __RELEASE_HEALTH_METRICS_OPTION_NAME,
            {},
            bad_sample_release_health_message,
            False,
            id="release health empty option on bad message should fail",
        ),
    ],
)
def test_metrics_schema_validator(
    codec: Optional[Codec[Any]],
    option_name: Optional[str],
    option_value: Optional[Mapping],
    message: ParsedMessage,
    is_valid: bool,
) -> None:
    """
    Test the behavior of the MetricsSchemaValidator class with different parameters.
    """
    with override_options({option_name: option_value}):
        validator = MetricsSchemaValidator(codec, option_name if option_name else None)
        if is_valid:
            validator.validate(message)
        else:
            with pytest.raises(ValidationError):
                return validator.validate(message)
