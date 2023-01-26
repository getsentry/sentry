from typing import List, Optional

from snuba_sdk import Column, Function

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
        rollup_to_start_func = {
            60: "toStartOfMinute",
            3600: "toStartOfHour",
            3600 * 24: "toDate",
        }
        rollup_func = rollup_to_start_func.get(interval)
        if rollup_func:
            if rollup_func == "toDate":
                self.time_column = Function(
                    "toUnixTimestamp",
                    [Function("toDateTime", [Function(rollup_func, [Column("timestamp")])])],
                    alias="time",
                )
            else:
                self.time_column = Function(
                    "toUnixTimestamp", [Function(rollup_func, [Column("timestamp")])], alias="time"
                )
        else:
            self.time_column = Function(
                "multiply",
                [
                    Function(
                        "intDiv",
                        [
                            Function(
                                "toUInt32", [Function("toUnixTimestamp", [Column("timestamp")])]
                            ),
                            interval,
                        ],
                    ),
                    interval,
                ],
                alias="time",
            )

        self.groupby = [self.time_column]
