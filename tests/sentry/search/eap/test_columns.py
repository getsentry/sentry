from collections.abc import Callable
from typing import Any

import pytest
from sentry_protos.snuba.v1.trace_item_attribute_pb2 import AttributeKey, AttributeValue
from sentry_protos.snuba.v1.trace_item_filter_pb2 import ComparisonFilter, TraceItemFilter

from sentry.search.eap.columns import ColumnDefinitions, ResolvedAttribute
from sentry.search.eap.occurrences.definitions import OCCURRENCE_DEFINITIONS
from sentry.search.eap.ourlogs.definitions import OURLOG_DEFINITIONS
from sentry.search.eap.profile_functions.definitions import PROFILE_FUNCTIONS_DEFINITIONS
from sentry.search.eap.resolver import SearchResolver
from sentry.search.eap.spans.definitions import SPAN_DEFINITIONS
from sentry.search.eap.trace_metrics.definitions import TRACE_METRICS_DEFINITIONS
from sentry.search.eap.types import SearchResolverConfig
from sentry.search.events.types import SnubaParams
from sentry.utils.validators import is_event_id, normalize_event_id_strict

TRACE_ID = "F13343D4-6625-40D0-946F-F5B4D564C642"
NORMALIZED_TRACE_ID = "f13343d4662540d0946ff5b4d564c642"


@pytest.mark.parametrize(
    ("definitions", "query", "internal_name", "expected_value"),
    [
        pytest.param(SPAN_DEFINITIONS, f"trace:{TRACE_ID}", "sentry.trace_id", NORMALIZED_TRACE_ID),
        pytest.param(SPAN_DEFINITIONS, "id:ABCDEF0123456789", "sentry.item_id", "abcdef0123456789"),
        pytest.param(OURLOG_DEFINITIONS, f"id:{TRACE_ID}", "sentry.item_id", NORMALIZED_TRACE_ID),
        pytest.param(
            TRACE_METRICS_DEFINITIONS, f"trace:{TRACE_ID}", "sentry.trace_id", NORMALIZED_TRACE_ID
        ),
        pytest.param(
            TRACE_METRICS_DEFINITIONS, f"id:{TRACE_ID}", "sentry.item_id", NORMALIZED_TRACE_ID
        ),
        pytest.param(
            PROFILE_FUNCTIONS_DEFINITIONS,
            f"trace:{TRACE_ID}",
            "sentry.trace_id",
            NORMALIZED_TRACE_ID,
        ),
        pytest.param(
            PROFILE_FUNCTIONS_DEFINITIONS, f"id:{TRACE_ID}", "sentry.item_id", NORMALIZED_TRACE_ID
        ),
        pytest.param(
            OCCURRENCE_DEFINITIONS, f"trace:{TRACE_ID}", "sentry.trace_id", NORMALIZED_TRACE_ID
        ),
        pytest.param(
            OCCURRENCE_DEFINITIONS, f"id:{TRACE_ID}", "sentry.item_id", NORMALIZED_TRACE_ID
        ),
    ],
)
def test_id_query_does_not_ignore_case_when_requested(
    definitions: ColumnDefinitions, query: str, internal_name: str, expected_value: str
) -> None:
    resolver = SearchResolver(
        params=SnubaParams(case_insensitive=True),
        config=SearchResolverConfig(),
        definitions=definitions,
    )

    where, _, _ = resolver.resolve_query(query)

    assert where == TraceItemFilter(
        comparison_filter=ComparisonFilter(
            key=AttributeKey(name=internal_name, type=AttributeKey.Type.TYPE_STRING),
            op=ComparisonFilter.OP_EQUALS,
            value=AttributeValue(val_str=expected_value),
        )
    )


@pytest.mark.parametrize(
    ("validator", "normalizer"),
    [
        pytest.param(None, normalize_event_id_strict, id="no validator"),
        pytest.param(is_event_id, None, id="no normalizer"),
    ],
)
def test_canonical_case_raises_when_missing_validator_or_normalizer(
    validator: Callable[[Any], bool] | None, normalizer: Callable[[Any], Any] | None
) -> None:
    with pytest.raises(ValueError, match="needs a validator and normalizer"):
        ResolvedAttribute(
            public_alias="trace",
            internal_name="sentry.trace_id",
            search_type="string",
            validator=validator,
            normalizer=normalizer,
            canonical_case=True,
        )
