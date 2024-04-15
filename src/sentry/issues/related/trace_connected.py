# Module to evaluate if groups have the same root cause
#
# The first case this module handles is environmental failures.
#
# Refer to README in module for more details.
from collections.abc import Mapping

from sentry.api.endpoints.organization_events_trace import find_errors_for_trace_id


def trace_connected_analysis(params: Mapping[str, str]) -> list[int]:
    # ?field=title
    # &field=event.type
    # &field=project
    # &field=timestamp
    # &field=trace
    # &field=issue
    # &field=event.type
    # &per_page=50
    # &project=-1
    # &query=trace%3A3291f3919a604bceb2c608b94756d496
    # &referrer=api.discover.query-table
    # &sort=-timestamp
    # &statsPeriod=7d
    if params.get("trace_id") is None:
        return []
    # project.id is an integer representing the project an issue belongs to
    # issue is the short slug represenging an issue
    # title is the title of the issue
    columns = ["project.id", "issue", "title"]
    trace_id = int(params["trace_id"])
    _ = find_errors_for_trace_id(params=params, trace_id=trace_id, selected_columns=columns)
    # XXX: Parse the error_events to get the groups
    return []
