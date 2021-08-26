import re
from dataclasses import dataclass
from typing import TYPE_CHECKING, Any, Callable, Dict, Optional, Sequence
from urllib.parse import urlparse

from sentry.spans.grouping.utils import hash_values

# TODO(3.8): This is a hack so we can get TypedDicts before 3.8
if TYPE_CHECKING:
    from mypy_extensions import TypedDict
else:

    def TypedDict(*args, **kwargs):
        pass


Span = TypedDict(
    "Span",
    {
        "trace_id": str,
        "parent_span_id": Optional[str],
        "span_id": str,
        "start_timestamp": float,
        "timestamp": float,
        "same_process_as_parent": bool,
        "op": str,
        "description": Optional[str],
        "tags": Optional[Any],
        "data": Optional[Any],
    },
)


CallableStrategy = Callable[[Span], Optional[str]]


@dataclass(frozen=True)
class SpanGroupingStrategy:
    name: str
    strategies: Sequence[CallableStrategy]

    def execute(self, spans: Sequence[Span]) -> Dict[str, str]:
        results = {}

        for span in spans:
            span_group = None
            # TODO: The following assumes the default fingerprint
            # of `{{ default }}` and does not handle any other case.

            # Try using all of the strategies in order to generate
            # the appropriate span group. The first strategy that
            # successfully generates a span group will be chosen.
            for strategy in self.strategies:
                span_group = strategy(span)
                if span_group is not None:
                    break

            # If no strategies generated a valid span group,
            # fall back to using the raw description strategy
            if span_group is None:
                span_group = raw_description_strategy(span)

            results[span["span_id"]] = span_group

        return results


def span_op(op_name: str) -> Callable[[CallableStrategy], CallableStrategy]:
    def wrapped(fn: CallableStrategy) -> CallableStrategy:
        return lambda span: fn(span) if span.get("op") == op_name else None

    return wrapped


def raw_description_strategy(span: Span) -> str:
    description = span.get("description") or ""
    return hash_values([description])


IN_CONDITION_PATTERN = re.compile(r" IN \(%s(, %s)+\)")


@span_op("db")
def normalized_db_span_in_condition_strategy(span: Span) -> Optional[str]:
    description = span.get("description") or ""
    cleaned, count = IN_CONDITION_PATTERN.subn(" IN (...)", description)
    if count == 0:
        return None
    return hash_values([cleaned])


HTTP_METHODS = {
    "GET",
    "HEAD",
    "POST",
    "PUT",
    "DELETE",
    "CONNECT",
    "OPTIONS",
    "TRACE",
    "PATCH",
}


@span_op("http.client")
def remove_http_client_query_string_strategy(span: Span) -> Optional[str]:
    description = span.get("description") or ""
    method, url_str = description.split(" ", 1)
    if method not in HTTP_METHODS:
        return None
    url = urlparse(url_str)
    return hash_values([url.scheme, url.netloc, url.path])
