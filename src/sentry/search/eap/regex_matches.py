from __future__ import annotations

import re
from bisect import bisect_left
from collections.abc import Iterator, Sequence
from time import monotonic
from typing import TYPE_CHECKING, Any

import re2

from sentry.api import event_search
from sentry.exceptions import InvalidSearchQuery
from sentry.search.eap.columns import ResolvedAttribute
from sentry.search.events.types import RegexMatch, RegexMatchesByField, SnubaData

if TYPE_CHECKING:
    from sentry.search.eap.resolver import SearchResolver

# google-re2 ships no type information, so a compiled pattern is untyped
CompiledPattern = Any

REGEX_DELIMITER = "//"

# The cap a user actually feels: how many separate highlights one filter can put on one value
MAX_MATCHES_PER_PATTERN = 100

# A pattern like `x*` matches at every position, so without a bound on matches *examined* a
# pattern that can match the empty string would walk every character of a value
MAX_SCANNED_MATCHES_PER_PATTERN = 1000

# Trying a pattern against a value costs a pass over it even when nothing matches, so the work
# is rows x fields x patterns, and none of the three is bounded: a request may ask for 9999
# rows, select any number of columns and carry any number of filters. Rows, characters and
# matches are all poor proxies for what that costs -- RE2 runs orders of magnitude slower once
# a pattern's DFA outgrows its memory budget -- so bound the time instead. Highlights are best
# effort, so a loaded worker giving up early costs a page some of them and nothing else.
MAX_SCAN_SECONDS = 0.1

# One pass over a value cannot be interrupted, so the deadline can only stop the next one. That
# makes this the real ceiling on a single row, and a legal pattern can cost ~80us per character
# of it. The logs table asks for a few hundred characters, so highlights are lost only on values
# longer than it renders anyway.
MAX_SCANNED_VALUE_CHARACTERS = 1_000

# Finding the astral characters costs more than the pass that found the spans, so let the re
# module scan for them rather than looping in Python
_ASTRAL = re.compile(r"[^\U00000000-\U0000FFFF]")

_re2_options = re2.Options()
_re2_options.log_errors = False


def _iter_regex_filters(
    terms: Sequence[event_search.QueryToken],
) -> Iterator[event_search.SearchFilter]:
    for term in terms:
        if isinstance(term, event_search.ParenExpression):
            yield from _iter_regex_filters(term.children)
        elif isinstance(term, event_search.SearchFilter) and term.value.is_regex:
            # A negated filter is satisfied by the absence of a match, so a row it returns has
            # nothing to highlight
            if term.operator != "!=":
                yield term


def _resolve_attribute(resolver: SearchResolver, column: str) -> ResolvedAttribute | None:
    try:
        resolved_column, context_definition = resolver.resolve_column(column)
    except InvalidSearchQuery:
        return None
    # `_resolve_regex_term` rejects a virtual column outright, so matching one here would
    # highlight a display value that Snuba never applied the pattern to
    if context_definition is not None:
        return None
    return resolved_column if isinstance(resolved_column, ResolvedAttribute) else None


def _compile_patterns_by_internal_name(
    resolver: SearchResolver, query_string: str, deadline: float
) -> dict[str, list[CompiledPattern]]:
    patterns: dict[str, list[CompiledPattern]] = {}

    for term in _iter_regex_filters(resolver.parse_search_query(query_string)):
        # Building a pattern's DFA can cost more than running it, and `validate_regex_pattern`
        # only warmed the cache for the bare pattern -- a case insensitive request compiles a
        # `(?i)` variant that misses it
        if monotonic() > deadline:
            break
        resolved_column = _resolve_attribute(resolver, term.key.name)
        if resolved_column is None:
            continue

        # Mirrors how `_resolve_regex_term` hands the pattern to Snuba, so a span here is one
        # ClickHouse would have matched on. The converse does not hold: an `OR` query returns
        # rows that satisfied some other branch, and those are scanned too
        prefix = "(?i)" if resolver.params.case_insensitive else ""
        try:
            compiled = re2.compile(f"{prefix}{term.value.raw_value}", _re2_options)
        except re2.error:
            # The query already ran, so failing to recompile here must not turn it into a 500
            continue
        patterns.setdefault(resolved_column.internal_name, []).append(compiled)

    return patterns


def _merge(spans: Sequence[tuple[int, int]], value: str) -> list[RegexMatch]:
    """Collapse overlapping spans so a client can paint them without nesting."""
    merged: list[RegexMatch] = []

    for start, end in sorted(spans):
        previous = merged[-1] if merged else None
        if previous is not None and start <= previous["end"]:
            if end > previous["end"]:
                previous["end"] = end
                previous["text"] = value[previous["start"] : end]
            continue
        merged.append({"start": start, "end": end, "text": value[start:end]})

    return _to_utf16_offsets(merged, value)


def _to_utf16_offsets(merged: list[RegexMatch], value: str) -> list[RegexMatch]:
    """Restate code point offsets as the UTF-16 code unit offsets JavaScript indexes by.

    A character outside the BMP is one code point to Python but two code units to JavaScript, so
    leaving these as code points makes `body.slice(start, end)` silently return the wrong text
    for any log line with an emoji ahead of the match. Characters inside the BMP are one unit in
    both, so accents and CJK shift nothing.
    """
    # Locating the astral characters walks the value, so skip it for a row with nothing to
    # shift, and stop at the last span rather than scanning the tail
    if not merged or value.isascii():
        return merged

    scanned = value[: merged[-1]["end"]]
    # Two bytes per code point means every one of them is a single UTF-16 unit, which rules out
    # the shift without the scan below
    if len(scanned.encode("utf-16-le", "surrogatepass")) == 2 * len(scanned):
        return merged

    astral = [match.start() for match in _ASTRAL.finditer(scanned)]

    for span in merged:
        span["start"] += bisect_left(astral, span["start"])
        span["end"] += bisect_left(astral, span["end"])

    return merged


def _scannable(value: str, max_string_length: int | None) -> str:
    """Return the part of a value worth matching against.

    That drops the `...` which `process_column_values` appends when it truncates, since matching
    the marker would highlight characters the log never contained -- an untruncated value is at
    most `max_string_length` already, so that cut leaves it alone -- and it stops at whatever
    length one uninterruptible pass can afford.
    """
    limit = MAX_SCANNED_VALUE_CHARACTERS
    if max_string_length is not None:
        limit = min(limit, max_string_length)
    return value[:limit]


def _match_value(
    patterns: Sequence[CompiledPattern], value: str, deadline: float
) -> list[RegexMatch]:
    spans: list[tuple[int, int]] = []

    for index, pattern in enumerate(patterns):
        # The first filter always gets its pass, so a value worth scanning at all is never
        # skipped outright; the rest go only as far as the deadline reaches
        if index and monotonic() > deadline:
            break

        scanned = 0
        kept = 0
        for match in pattern.finditer(value):
            scanned += 1
            start, end = match.start(), match.end()
            # A zero-width match highlights nothing
            if start != end:
                spans.append((start, end))
                kept += 1
            if kept >= MAX_MATCHES_PER_PATTERN or scanned >= MAX_SCANNED_MATCHES_PER_PATTERN:
                break

    return _merge(spans, value)


def find_regex_matches(
    resolver: SearchResolver,
    query_string: str,
    data: SnubaData,
    max_string_length: int | None = None,
) -> list[RegexMatchesByField] | None:
    """Locate, in each returned row, the substrings that the query's regex filters matched.

    ClickHouse matches with RE2, which accepts and rejects patterns that JavaScript's engine does
    not, so a client cannot re-derive these spans from the pattern alone. Offsets are UTF-16 code
    unit indexes, so `body.slice(start, end)` in JavaScript returns `text`.

    Spans are best effort, and an entry may be empty for a row that really did match. A row
    reaches us truncated to `max_string_length`, so a pattern anchored past the cut (`30s$`) has
    nothing to match against, only the first `MAX_SCANNED_VALUE_CHARACTERS` of a value are
    scanned, and a page that runs past `MAX_SCAN_SECONDS` stops where it got to.
    """
    if not data:
        return None

    # Every regex filter is delimited by `//`, so a query without one cannot carry a pattern and
    # is not worth re-parsing
    if REGEX_DELIMITER not in query_string:
        return None

    deadline = monotonic() + MAX_SCAN_SECONDS
    patterns_by_internal_name = _compile_patterns_by_internal_name(resolver, query_string, deadline)
    if not patterns_by_internal_name:
        return None

    patterns_by_field: dict[str, list[CompiledPattern]] = {}
    for field in data[0]:
        resolved_column = _resolve_attribute(resolver, field)
        if resolved_column is None:
            continue
        patterns = patterns_by_internal_name.get(resolved_column.internal_name)
        if patterns:
            patterns_by_field[field] = patterns

    if not patterns_by_field:
        return None

    matches: list[RegexMatchesByField] = []
    for row in data:
        row_matches: RegexMatchesByField = {}
        for field, patterns in patterns_by_field.items():
            if monotonic() > deadline:
                break
            value = row.get(field)
            if not isinstance(value, str):
                continue
            value_matches = _match_value(patterns, _scannable(value, max_string_length), deadline)
            if value_matches:
                row_matches[field] = value_matches
        matches.append(row_matches)

    return matches
