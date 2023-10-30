from typing import List, Optional

from sentry.issues.query import manual_group_on_time_aggregation
from sentry.search.events.builder import TimeseriesQueryBuilder
from sentry.search.events.types import ParamsType, QueryBuilderConfig, SelectType
from sentry.snuba.dataset import Dataset


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
        limit: Optional[int] = 10000,
        config: Optional[QueryBuilderConfig] = None,
    ):
        super().__init__(
            dataset,
            params,
            interval,
            query=query,
            selected_columns=selected_columns,
            equations=equations,
            config=config,
        )
        self.groupby = [self.time_column]

    @property
    def time_column(self) -> SelectType:
        return manual_group_on_time_aggregation(self.interval, "time")
