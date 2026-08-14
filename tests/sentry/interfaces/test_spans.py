from sentry.interfaces.spans import Span, Spans


def test_span_to_python_none() -> None:
    assert Span.to_python(None) is None


def test_spans_to_python_filters_none_entries() -> None:
    spans = Spans.to_python(
        [
            None,
            {
                "trace_id": "a0fa8803753e40fd8124b21eeb2986b5",
                "span_id": "8c931f4740435fb8",
                "op": "http",
            },
        ]
    )
    assert spans is not None
    assert len(list(spans)) == 1
    assert list(spans)[0].op == "http"


def test_spans_to_python_none() -> None:
    assert Spans.to_python(None) is None
