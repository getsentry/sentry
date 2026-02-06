from __future__ import annotations

import logging
from datetime import datetime

from sentry.api.utils import default_start_end_dates
from sentry.models.group import Group
from sentry.search.eap.types import AdditionalQueries, SearchResolverConfig
from sentry.search.events.types import SnubaParams
from sentry.snuba.occurrences_rpc import Occurrences
from sentry.snuba.referrer import Referrer

logger = logging.getLogger("sentry.tagstore")


def get_occurrences_with_spans(
    group: Group, start: datetime | None = None, end: datetime | None = None, limit: int = 1000
) -> list[str | int]:
    """
    Given a Group, return a list of Occurrence IDs for Occurrences on Traces that
    also have at least one Span associated with that Trace.
    """
    default_start, default_end = default_start_end_dates()
    start = start if start is not None else default_start
    end = end if end is not None else default_end

    params = SnubaParams(
        start=start,
        end=end,
        projects=[group.project],
        organization=group.project.organization,
    )
    referrer = Referrer.GET_OCCURRENCES_WITH_SPANS

    # As far as I can tell, we need _a_ filter on span to enforce that a span exists.
    # An easy always-true-query workaround is to say that the span.op is not this
    # dummy string.
    dummy_span_op = "_XYZ_ABC_XYZ__see__get_occurrences_with_spans"

    repsonse = Occurrences.run_table_query(
        params=params,
        query_string=f"group_id:[{group.id}]",
        selected_columns=[
            "id",
        ],
        equations=[],
        orderby=None,
        offset=0,
        limit=limit,
        referrer=referrer,
        config=SearchResolverConfig(),
        additional_queries=AdditionalQueries(
            span=[f"!span.op:{dummy_span_op}"], log=None, metric=None
        ),
    )
    return [
        str(datum.get("id"))
        for datum in repsonse["data"]
        if datum is not None and datum.get("id") is not None
    ]
