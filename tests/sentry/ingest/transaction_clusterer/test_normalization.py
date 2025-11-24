import orjson
from sentry_conventions.attributes import ATTRIBUTE_NAMES

from sentry.ingest.transaction_clusterer.normalization import normalize_segment_name
from sentry.spans.consumers.process_segments.types import CompatibleSpan


def _segment_span(**kwargs) -> CompatibleSpan:
    segment_span: CompatibleSpan = {
        "organization_id": 1,
        "project_id": 1,
        "trace_id": "94576097f3a64b68b85a59c7d4e3ee2a",
        "span_id": "a49b42af9fb69da0",
        "start_timestamp": 1707953018.865,
        "end_timestamp": 1707953018.972,
        "retention_days": 90,
        "received": 1707953019.044972,
        "status": "ok",
        "exclusive_time": 0.1,
        "op": "default",
        "sentry_tags": {},
        "name": "default",
    }
    segment_span.update(**kwargs)  # type:ignore[call-arg]
    return segment_span


# Ported from Relay:
# https://github.com/getsentry/relay/blob/aad4b6099d12422e88dd5df49abae11247efdd99/relay-event-normalization/src/transactions/processor.rs#L789
def test_identifiers_scrubbed():
    segment_span = _segment_span(name="/foo/2fd4e1c67a2d28fced849ee1bb76e7391b93eb12/user/123/0")

    normalize_segment_name(segment_span)

    assert segment_span["name"] == "/foo/*/user/*/0"
    attributes = segment_span.get("attributes") or {}
    assert attributes[ATTRIBUTE_NAMES.SENTRY_SEGMENT_NAME] == {
        "type": "string",
        "value": "/foo/*/user/*/0",
    }
    assert attributes[ATTRIBUTE_NAMES.SENTRY_SPAN_SOURCE] == {
        "type": "string",
        "value": "sanitized",
    }
    assert attributes[f"sentry._meta.fields.attributes.{ATTRIBUTE_NAMES.SENTRY_SEGMENT_NAME}"] == {
        "type": "string",
        "value": orjson.dumps(
            {"meta": {"": {"rem": [["int", "s", 5, 45], ["int", "s", 51, 54]]}}}
        ).decode(),
    }


def test_name_attribute_takes_precedence_over_name():
    segment_span = _segment_span(
        name="/foo/2fd4e1c67a2d28fced849ee1bb76e7391b93eb12/user/123/0",
        attributes={
            ATTRIBUTE_NAMES.SENTRY_SEGMENT_NAME: {
                "type": "string",
                "value": "/bar/2fd4e1c67a2d28fced849ee1bb76e7391b93eb12",
            }
        },
    )

    normalize_segment_name(segment_span)

    assert segment_span["name"] == "/bar/*"
    attributes = segment_span.get("attributes") or {}
    assert attributes[ATTRIBUTE_NAMES.SENTRY_SEGMENT_NAME] == {
        "type": "string",
        "value": "/bar/*",
    }
    assert attributes[ATTRIBUTE_NAMES.SENTRY_SPAN_SOURCE] == {
        "type": "string",
        "value": "sanitized",
    }
    assert attributes[f"sentry._meta.fields.attributes.{ATTRIBUTE_NAMES.SENTRY_SEGMENT_NAME}"] == {
        "type": "string",
        "value": orjson.dumps({"meta": {"": {"rem": [["int", "s", 5, 45]]}}}).decode(),
    }


def test_no_meta_changes_if_no_name_changes():
    segment_span = _segment_span(name="/foo")

    normalize_segment_name(segment_span)

    assert segment_span["name"] == "/foo"
    attributes = segment_span.get("attributes") or {}
    assert len(attributes) == 0
