"""Canonical UI links for Explore saved queries.

A saved query's id alone does not open it. Explore reads `?id=` only for the
page title -- the page itself opens on the viewer's own defaults -- so a link
that restores the query has to carry the query's own parameters. The frontend
builds that link in `static/app/views/explore/utils.tsx`
(`getSavedQueryTraceItemUrl`), which is what the saved-queries table links to;
this module mirrors it so API consumers get the same URL without reconstructing
one themselves.

It exists because consumers that cannot run the frontend builder were inventing
URLs instead -- see CW-2081, where an agent handed a user
`/explore/spans/?savedQueryId=<id>`: a route that does not exist, keyed by a
query param that does not either.

Kept deliberately narrow: a dataset whose link this module cannot build exactly
gets no link at all, because a wrong deep link is worse than none. See
`_build_query_params` for which those are.
"""

from __future__ import annotations

import datetime
from typing import TYPE_CHECKING, Any
from urllib.parse import quote, urlencode

from sentry.organizations.absolute_url import has_customer_domain, organization_absolute_url
from sentry.utils import json

if TYPE_CHECKING:
    from sentry.api.serializers.models.exploresavedquery import (
        ExploreSavedQueryResponse,
        QueryResponseType,
    )

# Datasets whose Explore surface takes the stored query verbatim. Everything
# else is omitted on purpose:
#
# - `metrics` encodes its query state through the frontend's own class
#   serializers, applying defaults this module cannot reproduce faithfully.
# - a multi-query (compare) saved query goes through a normalization pass on
#   the frontend before it is encoded.
_TRACES_DATASETS = frozenset(("spans", "segment_spans"))
_SUPPORTED_DATASETS = _TRACES_DATASETS | frozenset(("logs", "replays", "ai_conversations"))


def build_explore_saved_query_url(
    saved_query: ExploreSavedQueryResponse, organization_slug: str
) -> str | None:
    """An absolute URL that opens `saved_query` in Explore with its parameters applied.

    Takes the serialized saved query -- the same shape the API returns and the
    frontend builder consumes -- so the two read the same fields. Returns None
    for a saved query whose link cannot be built exactly.
    """
    dataset = saved_query.get("dataset")
    if dataset not in _SUPPORTED_DATASETS:
        return None

    queries = saved_query.get("query") or []
    if len(queries) != 1:
        # No queries at all is nothing to link to; more than one is a compare
        # query, whose encoding is normalized on the frontend first.
        return None

    params = _build_query_params(saved_query, queries[0], dataset)
    if params is None:
        return None

    return organization_absolute_url(
        has_customer_domain=has_customer_domain(),
        slug=organization_slug,
        path=f"/organizations/{organization_slug}{_PATHS[dataset]}",
        query=_stringify(params),
    )


_PATHS = {
    "spans": "/explore/traces/",
    "segment_spans": "/explore/traces/",
    "logs": "/explore/logs/",
    "replays": "/explore/replays/",
    "ai_conversations": "/explore/agents/",
}


def _build_query_params(
    saved_query: ExploreSavedQueryResponse,
    query: QueryResponseType,
    dataset: str,
) -> dict[str, Any] | None:
    """The query params for one saved query, keyed as its Explore surface reads them."""
    # Page filters are shared by every surface. An empty project list is sent as
    # an empty string rather than dropped, so the URL still says "My Projects"
    # instead of falling back to the viewer's last selection.
    projects = saved_query.get("projects") or []
    params: dict[str, Any] = {
        "project": projects if projects else "",
        "environment": saved_query.get("environment"),
        "statsPeriod": saved_query.get("range"),
        "start": _normalize_datetime(saved_query.get("start")),
        "end": _normalize_datetime(saved_query.get("end")),
        "id": saved_query.get("id"),
        "title": saved_query.get("name"),
    }

    if dataset in _TRACES_DATASETS:
        group_by = query.get("groupby") or []
        cross_events = saved_query.get("crossEvents")
        params.update(
            {
                "interval": saved_query.get("interval"),
                "mode": query.get("mode"),
                "query": query.get("query"),
                "field": query.get("fields"),
                # An aggregate query with no group by still has to say so, or
                # Explore falls back to its default grouping.
                "groupBy": group_by if group_by else [""],
                "sort": query.get("orderby"),
                "aggregateField": _encode_json_list(query.get("aggregateField")),
                "visualize": _encode_json_list(query.get("visualize")),
                "caseInsensitive": "1" if query.get("caseInsensitive") else None,
                # Cross-event queries ride as one JSON value, not one per entry.
                "crossEvents": (json.dumps(cross_events) if cross_events else None),
            }
        )
        return params

    if dataset == "logs":
        # Logs reads its own `logs*` params; the generic `query=` is ignored on
        # that view.
        aggregate_fn, aggregate_param = _split_aggregate(query)
        has_aggregate_field = query.get("aggregateField") is not None
        params.update(
            {
                "logsQuery": query.get("query"),
                "logsFields": query.get("fields"),
                "logsGroupBy": None if has_aggregate_field else query.get("groupby"),
                "logsSortBys": query.get("orderby"),
                "logsAggregate": None if has_aggregate_field else aggregate_fn,
                "logsAggregateParam": None if has_aggregate_field else aggregate_param,
                "aggregateField": _encode_json_list(query.get("aggregateField")),
                "interval": saved_query.get("interval"),
                "mode": query.get("mode"),
                "caseInsensitive": "1" if query.get("caseInsensitive") else None,
            }
        )
        return params

    # Replays and agent conversations both take a plain search query.
    params["query"] = query.get("query")
    if dataset == "ai_conversations":
        agents = saved_query.get("agent")
        if agents:
            params["agent"] = ",".join(agents)
    return params


def _split_aggregate(query: QueryResponseType) -> tuple[str | None, str | None]:
    """`p95(span.duration)` as the pair Logs reads it in: the function and its argument."""
    visualizes = query.get("visualize") or []
    y_axes = visualizes[0].get("yAxes") if visualizes else None
    visualize = y_axes[0] if y_axes else None
    if not visualize or "(" not in visualize:
        return None, None
    fn, _, rest = visualize.partition("(")
    return fn, rest.partition(")")[0]


def _encode_json_list(values: list[Any] | None) -> list[str] | None:
    """Each entry as its own compact JSON param value, the way the frontend sends them.

    `sentry.utils.json` already encodes without whitespace, which is what the
    frontend's `JSON.stringify` produces.
    """
    if not values:
        return None
    return [json.dumps(value) for value in values]


def _normalize_datetime(value: str | None) -> str | None:
    """A stored timestamp in the form the page filters parse, or None if unparseable."""
    if not value:
        return None
    try:
        parsed = datetime.datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
    if parsed.tzinfo is not None:
        parsed = parsed.astimezone(datetime.UTC).replace(tzinfo=None)
    return parsed.strftime("%Y-%m-%dT%H:%M:%S.") + f"{parsed.microsecond // 1000:03d}"


def _stringify(params: dict[str, Any]) -> str:
    """Encode params the way the frontend's `query-string` does.

    Keys sorted, `None` dropped but empty strings kept, list values repeated
    once per entry, and everything percent-encoded -- spaces as `%20`, not `+`,
    so the URL matches the one the UI produces character for character.
    """
    pairs: list[tuple[str, str]] = []
    for key in sorted(params):
        value = params[key]
        if value is None:
            continue
        if isinstance(value, (list, tuple)):
            pairs.extend((key, str(entry)) for entry in value)
        else:
            pairs.append((key, str(value)))
    return urlencode(pairs, quote_via=quote, safe="")
