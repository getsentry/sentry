from typing import Dict, List

from typing_extensions import TypedDict

DateString = str


class QuerySessionGroup(TypedDict):
    by: Dict[str, str]
    totals: Dict[str, int]
    series: Dict[str, List[int]]


class QuerySessionsResponse(TypedDict):
    start: DateString
    end: DateString
    intervals: List[DateString]
    query: str
    groups: List[QuerySessionGroup]
