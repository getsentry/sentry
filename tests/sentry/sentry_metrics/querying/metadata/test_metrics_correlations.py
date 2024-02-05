import pytest

from sentry.sentry_metrics.querying.metadata.metrics_correlations import (
    MeasurementsCorrelationsSource,
    MetricsSummariesCorrelationsSource,
    SpansDurationCorrelationsSource,
    TransactionDurationCorrelationsSource,
)
from sentry.snuba.metrics.naming_layer.mri import (
    ErrorsMRI,
    SessionMRI,
    SpanMRI,
    TransactionMRI,
    parse_mri,
)


def assign_correlation_source_for_transaction_mri(mri):
    if not isinstance(mri, TransactionMRI):
        raise ValueError(f"Non TransactionMRI: {mri.value}")

    if mri == TransactionMRI.DURATION:
        return TransactionDurationCorrelationsSource

    parsed_mri = parse_mri(mri.value)
    if parsed_mri is None:
        raise ValueError(f"Illegal MRI: {mri.value}")

    if parsed_mri.name.startswith("measurements."):
        return MeasurementsCorrelationsSource

    if parsed_mri.namespace == "spans":
        if mri == TransactionMRI.SPAN_SELF_TIME:
            return SpansDurationCorrelationsSource
        if mri == TransactionMRI.SPAN_DURATION:
            return SpansDurationCorrelationsSource
        return None

    return MetricsSummariesCorrelationsSource


@pytest.mark.parametrize(
    ["correlation_source"],
    [
        pytest.param(MeasurementsCorrelationsSource, id="measurements"),
        pytest.param(SpansDurationCorrelationsSource, id="span duration"),
        pytest.param(TransactionDurationCorrelationsSource, id="transaction duration"),
    ],
)
@pytest.mark.parametrize(
    ["mri", "expected_source"],
    [
        # ========== SessionMRI ==========
        *[pytest.param(mri.value, MetricsSummariesCorrelationsSource) for mri in SessionMRI],
        # ==========  Transaction MRI ==========
        *[
            pytest.param(
                mri.value,
                assign_correlation_source_for_transaction_mri(mri),
            )
            for mri in TransactionMRI
        ],
        # ==========  Span MRI ==========
        *[
            pytest.param(
                mri.value,
                SpansDurationCorrelationsSource
                if mri is SpanMRI.SELF_TIME or mri is SpanMRI.DURATION
                else MetricsSummariesCorrelationsSource,
                marks=pytest.mark.skipif(
                    mri.value.startswith("e:spans_light/"),
                    reason="Unexpected namespace: spans_light",
                ),
            )
            for mri in SpanMRI
        ],
        # ==========  Error MRI ==========
        pytest.param(ErrorsMRI.EVENT_INGESTED.value, MetricsSummariesCorrelationsSource),
        # ==========  Custom MRI ==========
        pytest.param(
            "d:custom/sentry.process_profile.track_outcome@second",
            MetricsSummariesCorrelationsSource,
        ),
    ],
)
def test_correlation_source_supports_mri(correlation_source, mri, expected_source):
    supported = expected_source is correlation_source
    assert correlation_source.supports(mri) == supported

    # Treat metrics summary as a fallback, ie it should support all valid MRIs
    assert MetricsSummariesCorrelationsSource.supports(mri)
