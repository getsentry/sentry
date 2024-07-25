from sentry.issues.query import manual_group_on_time_aggregation
from sentry.search.events.builder.discover import TimeseriesQueryBuilder
from sentry.search.events.types import ParamsType, QueryBuilderConfig, SelectType, SnubaParams
from sentry.snuba.dataset import Dataset


class IssuePlatformTimeseriesQueryBuilder(TimeseriesQueryBuilder):
    """The IssuePlatform dataset isn't using the TimeSeriesProcessor which does the translation of 'time' to 'timestamp'."""

    def __init__(
        self,
        dataset: Dataset,
        params: ParamsType,
        interval: int,
        snuba_params: SnubaParams | None = None,
        query: str | None = None,
        selected_columns: list[str] | None = None,
        equations: list[str] | None = None,
        limit: int | None = 10000,
        config: QueryBuilderConfig | None = None,
    ):
        super().__init__(
            dataset,
            params,
            interval,
            snuba_params=snuba_params,
            query=query,
            selected_columns=selected_columns,
            equations=equations,
            config=config,
        )
        self.groupby = [self.time_column]

    @property
    def time_column(self) -> SelectType:
        return manual_group_on_time_aggregation(self.interval, "time")
