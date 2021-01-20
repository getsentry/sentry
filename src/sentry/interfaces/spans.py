__all__ = ("Spans", "Span")

from sentry.interfaces.base import Interface

SPAN_KEYS = (
    "trace_id",
    "parent_span_id",
    "span_id",
    "start_timestamp",
    "same_process_as_parent",
    "description",
    "tags",
    "timestamp",
    "op",
    "data",
)


class Span(Interface):
    """
    Holds timing spans related to APM and tracing.

    >>> {
    >>>   'trace_id': 'a0fa8803753e40fd8124b21eeb2986b5',
    >>>   'parent_span_id': '9c2a6db8c79068a2',
    >>>   'span_id': '8c931f4740435fb8',
    >>>   'start_timestamp': '2019-06-14T14:01:41Z',
    >>>   'same_process_as_parent': true,
    >>>   'description': 'http://httpbin.org/base64/aGVsbG8gd29ybGQK GET',
    >>>   'tags': { 'http.status_code': 200, 'error': false },
    >>>   'timestamp': '2019-06-14T14:01:41Z',
    >>>   'op': 'http',
    >>>   'data': {
    >>>     'url': 'http://httpbin.org/base64/aGVsbG8gd29ybGQK',
    >>>     'status_code': 200,
    >>>     'reason': 'OK',
    >>>     'method': 'GET'
    >>>   }
    >>> }
    """

    @classmethod
    def to_python(cls, data):
        for key in SPAN_KEYS:
            data.setdefault(key, None)
        return cls(**data)


class Spans(Interface):
    """
    Contains a list of Span interfaces
    """

    display_score = 1950
    score = 1950
    path = "spans"

    @classmethod
    def to_python(cls, data):
        spans = [Span.to_python(span) for span in data]
        return cls(spans=spans)

    def __iter__(self):
        return iter(self.spans)

    def to_json(self):
        return [span.to_json() for span in self]
