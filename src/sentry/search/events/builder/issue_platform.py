from typing import List, Optional

from sentry.issues.query import manual_group_on_time_aggregation
from sentry.search.events.builder import TimeseriesQueryBuilder
from sentry.search.events.types import ParamsType
from sentry.utils.snuba import Dataset


class IssuePlatformTimeseriesQueryBuilder(TimeseriesQueryBuilder):
    """The IssuePlatform dataset isn't using the TimeSeriesProcessor which does the translation of 'time' to 'timestamp'."""

    def __init__(
        self,
        dataset: Dataset,
        params: ParamsType,
        interval: int,
        query: Optional[str] = None,
        selected_columns: Optional[List[str]] = None,
        equations: Optional[List[str]] = None,
        functions_acl: Optional[List[str]] = None,
        limit: Optional[int] = 10000,
        has_metrics: bool = False,
        skip_tag_resolution: bool = False,
    ):
        super().__init__(
            dataset,
            params,
            interval,
            query=query,
            selected_columns=selected_columns,
            equations=equations,
            functions_acl=functions_acl,
            has_metrics=has_metrics,
            skip_tag_resolution=skip_tag_resolution,
        )
        self.time_column = manual_group_on_time_aggregation(interval, "time")
        self.groupby = [self.time_column]
