from typing import Any, Mapping, Optional

import pytest
from sentry_kafka_schemas.codecs import Codec, ValidationError
from sentry_kafka_schemas.schema_types.ingest_metrics_v1 import IngestMetric

from sentry.sentry_metrics.configuration import (
    GENERIC_METRICS_SCHEMA_VALIDATION_RULES_OPTION_NAME,
    RELEASE_HEALTH_SCHEMA_VALIDATION_RULES_OPTION_NAME,
)
from sentry.sentry_metrics.consumers.indexer.processing import INGEST_CODEC
from sentry.sentry_metrics.consumers.indexer.schema_validator import MetricsSchemaValidator
from sentry.testutils.helpers.options import override_options
from sentry.testutils.pytest.fixtures import django_db_all

good_sample_transactions_message = IngestMetric(
    org_id=1,
    project_id=2,
    name="metric_name",
    type="c",
    timestamp=1629360000,
    tags={"tag1": "value1", "tag2": "value2"},
    value=1,
    retention_days=90,
)
bad_sample_transactions_message = IngestMetric(
    org_id=1,
    project_id=2,
    name="metric_name",
    type="c",
    timestamp=1629360000,
    tags={"tag1": "value1", "tag2": "value2"},
    value=1,
    retention_days=90000000,  # this is the bad part
)
good_sample_spans_message = IngestMetric(
    org_id=1,
    project_id=2,
    name="metric_name",
    type="c",
    timestamp=1629360000,
    tags={"tag1": "value1", "tag2": "value2"},
    value=1,
    retention_days=90,
)
bad_sample_spans_message = IngestMetric(
    org_id=1,
    project_id=2,
    name="metric_name",
    type="c",
    timestamp=1629360000,
    tags={"tag1": "value1", "tag2": "value2"},
    value=1,
    retention_days=900000,  # this is the bad part
)
good_sample_release_health_message = IngestMetric(
    org_id=1,
    project_id=2,
    name="metric_name",
    type="c",
    timestamp=1629360000,
    tags={"tag1": "value1", "tag2": "value2"},
    value=1,
    retention_days=90,
)
bad_sample_release_health_message = IngestMetric(
    org_id=1,
    project_id=2,
    name="metric_name",
    type="c",
    timestamp=1629360000,
    tags={"tag1": "value1", "tag2": "value2"},
    value=1,
    retention_days=9000000,  # this is the bad part
)


@django_db_all
@pytest.mark.parametrize(
    "codec,option_name,option_value,message,use_case_id,is_valid",
    [
        pytest.param(
            None, None, None, good_sample_transactions_message, "transactions", True, id="no codec"
        ),
        pytest.param(
            INGEST_CODEC,
            None,
            None,
            good_sample_transactions_message,
            "transactions",
            True,
            id="no option set",
        ),
        pytest.param(
            INGEST_CODEC,
            GENERIC_METRICS_SCHEMA_VALIDATION_RULES_OPTION_NAME,
            {},
            good_sample_transactions_message,
            "transactions",
            True,
            id="empty option on good message should pass",
        ),
        pytest.param(
            INGEST_CODEC,
            GENERIC_METRICS_SCHEMA_VALIDATION_RULES_OPTION_NAME,
            {},
            bad_sample_transactions_message,
            "transactions",
            False,
            id="empty option on bad message should fail",
        ),
        pytest.param(
            INGEST_CODEC,
            GENERIC_METRICS_SCHEMA_VALIDATION_RULES_OPTION_NAME,
            {"transactions": 0.0},
            good_sample_transactions_message,
            "transactions",
            True,
            id="no sampling on good message should pass",
        ),
        pytest.param(
            INGEST_CODEC,
            GENERIC_METRICS_SCHEMA_VALIDATION_RULES_OPTION_NAME,
            {"transactions": 0.0},
            bad_sample_transactions_message,
            "transactions",
            True,
            id="no sampling on bad message should pass",
        ),
        pytest.param(
            INGEST_CODEC,
            GENERIC_METRICS_SCHEMA_VALIDATION_RULES_OPTION_NAME,
            {"transactions": 0.0},
            good_sample_spans_message,
            "spans",
            True,
            id="no sampling on good spans message should pass",
        ),
        pytest.param(
            INGEST_CODEC,
            GENERIC_METRICS_SCHEMA_VALIDATION_RULES_OPTION_NAME,
            {"transactions": 0.0},
            bad_sample_spans_message,
            "spans",
            False,
            id="no sampling on bad spans message should fail",
        ),
        pytest.param(
            INGEST_CODEC,
            GENERIC_METRICS_SCHEMA_VALIDATION_RULES_OPTION_NAME,
            {"transactions": 1.0},
            good_sample_transactions_message,
            "transactions",
            True,
            id="full sampling on good message should pass",
        ),
        pytest.param(
            INGEST_CODEC,
            GENERIC_METRICS_SCHEMA_VALIDATION_RULES_OPTION_NAME,
            {"transactions": 1.0},
            bad_sample_transactions_message,
            "transactions",
            False,
            id="full sampling on bad message should fail",
        ),
        pytest.param(
            INGEST_CODEC,
            RELEASE_HEALTH_SCHEMA_VALIDATION_RULES_OPTION_NAME,
            {},
            good_sample_release_health_message,
            "sessions",
            True,
            id="release health empty option on good message should pass",
        ),
        pytest.param(
            INGEST_CODEC,
            RELEASE_HEALTH_SCHEMA_VALIDATION_RULES_OPTION_NAME,
            {},
            bad_sample_release_health_message,
            "sessions",
            False,
            id="release health empty option on bad message should fail",
        ),
    ],
)
def test_metrics_schema_validator(
    codec: Optional[Codec[Any]],
    option_name: Optional[str],
    option_value: Optional[Mapping],
    message: IngestMetric,
    use_case_id: str,
    is_valid: bool,
) -> None:
    """
    Test the behavior of the MetricsSchemaValidator class with different parameters.
    """
    with override_options({option_name: option_value}):
        validator = MetricsSchemaValidator(codec, option_name if option_name else None)
        if is_valid:
            validator.validate(use_case_id, message)
        else:
            with pytest.raises(ValidationError):
                return validator.validate(use_case_id, message)
