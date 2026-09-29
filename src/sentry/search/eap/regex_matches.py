from __future__ import annotations

from collections.abc import Iterator, Sequence
from itertools import accumulate
from typing import TYPE_CHECKING, Any

import re2

from sentry.api import event_search
from sentry.exceptions import InvalidSearchQuery
from sentry.search.eap.columns import ResolvedAttribute
from sentry.search.events.types import RegexMatchesByField, SnubaData

if TYPE_CHECKING:
    from sentry.search.eap.resolver import SearchResolver

# google-re2 ships no type information
CompiledPattern = Any

REGEX_DELIMITER = "//"

# RE2 runs orders of magnitude slower once a pattern's DFA outgrows its memory budget
MAX_SCANNED_CHARACTERS = 1_000

# A pattern like `\w+` would otherwise put a span on every word of every row
MAX_MATCHES_PER_VALUE = 100

_re2_options = re2.Options()
_re2_options.log_errors = False


def _iter_regex_filters(
    terms: Sequence[event_search.QueryToken],
) -> Iterator[event_search.SearchFilter]:
    for term in terms:
        if isinstance(term, event_search.ParenExpression):
            yield from _iter_regex_filters(term.children)
        elif isinstance(term, event_search.SearchFilter) and term.value.is_regex:
            # A negated filter is satisfied by the absence of a match
            if term.operator != "!=":
                yield term


def _resolve_attribute(resolver: SearchResolver, column: str) -> ResolvedAttribute | None:
    try:
        resolved_column, context_definition = resolver.resolve_column(column)
    except InvalidSearchQuery:
        return None
    # A virtual column displays a value Snuba never applied the pattern to
    if context_definition is not None:
        return None
    return resolved_column if isinstance(resolved_column, ResolvedAttribute) else None


def _resolve_patterns_by_field(
    resolver: SearchResolver, query_string: str, fields: Sequence[str]
) -> dict[str, list[CompiledPattern]]:
    """Pair each returned field with the patterns Snuba matched against the attribute behind it."""
    fields_by_internal_name: dict[str, list[str]] = {}
    for field in fields:
        resolved_column = _resolve_attribute(resolver, field)
        if resolved_column is not None:
            fields_by_internal_name.setdefault(resolved_column.internal_name, []).append(field)

    patterns_by_field: dict[str, list[CompiledPattern]] = {}
    for term in _iter_regex_filters(resolver.parse_search_query(query_string)):
        resolved_column = _resolve_attribute(resolver, term.key.name)
        if resolved_column is None:
            continue
        matched_fields = fields_by_internal_name.get(resolved_column.internal_name)
        if not matched_fields:
            continue

        # Mirrors how `_resolve_regex_term` hands the pattern to Snuba
        prefix = "(?i)" if resolver.params.case_insensitive else ""
        try:
            compiled = re2.compile(f"{prefix}{term.value.raw_value}", _re2_options)
        except re2.error:
            # The query already ran, so failing to recompile here must not turn it into a 500
            continue
        for field in matched_fields:
            patterns_by_field.setdefault(field, []).append(compiled)

    return patterns_by_field


def _spans_for_client(spans: list[tuple[int, int]], value: str) -> list[tuple[int, int]]:
    """Collapse overlapping spans and restate them as the UTF-16 offsets JavaScript indexes by.

    An astral character is one code point to Python but two code units to JavaScript, so leaving
    these as code points makes `value.slice(start, end)` return the wrong text for any line with
    an emoji ahead of the match.
    """
    merged: list[tuple[int, int]] = []
    for start, end in sorted(spans):
        if merged and start <= merged[-1][1]:
            merged[-1] = (merged[-1][0], max(end, merged[-1][1]))
        else:
            merged.append((start, end))

    if value.isascii():
        return merged
    shift = list(accumulate((ord(character) > 0xFFFF for character in value), initial=0))
    return [(start + shift[start], end + shift[end]) for start, end in merged]


def find_regex_matches(
    resolver: SearchResolver,
    query_string: str,
    data: SnubaData,
    max_string_length: int | None = None,
) -> list[RegexMatchesByField] | None:
    """Locate, in each returned row, the substrings that the query's regex filters matched.

    ClickHouse matches with RE2, which accepts and rejects patterns that JavaScript's engine does
    not, so a client cannot re-derive these spans from the pattern alone. Best effort: a pattern
    anchored past `MAX_SCANNED_CHARACTERS` (`30s$`) has nothing to match against.
    """
    if not data:
        return None

    # Every regex filter is delimited by `//`, so skip the re-parse when there is none
    if REGEX_DELIMITER not in query_string:
        return None

    patterns_by_field = _resolve_patterns_by_field(resolver, query_string, list(data[0]))
    if not patterns_by_field:
        return None

    # Stop short of the `...` that `process_column_values` appends when it truncates
    limit = min(MAX_SCANNED_CHARACTERS, max_string_length or MAX_SCANNED_CHARACTERS)

    matches: list[RegexMatchesByField] = []
    for row in data:
        row_matches: RegexMatchesByField = {}
        for field, patterns in patterns_by_field.items():
            value = row.get(field)
            if not isinstance(value, str):
                continue

            scanned = value[:limit]
            spans: list[tuple[int, int]] = []
            for pattern in patterns:
                if len(spans) >= MAX_MATCHES_PER_VALUE:
                    break
                for match in pattern.finditer(scanned):
                    start, end = match.start(), match.end()
                    # A zero-width match highlights nothing
                    if start != end:
                        spans.append((start, end))
                        if len(spans) >= MAX_MATCHES_PER_VALUE:
                            break

            if spans:
                row_matches[field] = _spans_for_client(spans, scanned)
        matches.append(row_matches)

    return matches
