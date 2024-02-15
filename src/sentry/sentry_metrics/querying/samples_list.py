from abc import ABC, abstractmethod
from datetime import datetime
from typing import Any

from snuba_sdk import And, Condition, Op, Or

from sentry.search.events.builder import SpansIndexedQueryBuilder
from sentry.search.events.types import SnubaParams
from sentry.snuba.dataset import Dataset
from sentry.snuba.metrics.naming_layer.mri import SpanMRI
from sentry.snuba.referrer import Referrer


class SamplesListExecutor(ABC):
    def __init__(
        self,
        mri: str,
        params: dict[str, Any],
        snuba_params: SnubaParams,
        fields: list[str],
        query: str | None,
        rollup: int,
        referrer: Referrer,
    ):
        self.mri = mri
        self.params = params
        self.snuba_params = snuba_params
        self.fields = fields
        self.query = query
        self.rollup = rollup
        self.referrer = referrer

    @classmethod
    @abstractmethod
    def supports(cls, metric_mri: str) -> bool:
        raise NotImplementedError

    @abstractmethod
    def execute(self, offset, limit):
        raise NotImplementedError

    def get_spans_by_key(self, span_ids: list[tuple[str, str, str]]):
        if not span_ids:
            return {"data": []}

        builder = SpansIndexedQueryBuilder(
            Dataset.SpansIndexed,
            self.params,
            snuba_params=self.snuba_params,
            selected_columns=self.fields,
            limit=len(span_ids),
            offset=0,
        )

        # Using `IN` sometimes does not use the bloomfilter index
        # on the table. So we're explicitly writing the condition
        # using `OR`s.
        #
        # May not be necessary because it's also filtering on the
        # `span.group` as well which allows Clickhouse to filter
        # via the primary key but this is a precaution.
        conditions = [
            And(
                [
                    Condition(builder.column("span.group"), Op.EQ, group),
                    Condition(
                        builder.column("timestamp"), Op.EQ, datetime.fromisoformat(timestamp)
                    ),
                    Condition(builder.column("id"), Op.EQ, span_id),
                ]
            )
            for (group, timestamp, span_id) in span_ids
        ]

        if len(conditions) == 1:
            span_condition = conditions[0]
        else:
            span_condition = Or(conditions)

        builder.add_conditions([span_condition])

        query_results = builder.run_query(self.referrer.value)
        return builder.process_results(query_results)


class SpansSamplesListExecutor(SamplesListExecutor):
    @classmethod
    def supports(cls, mri: str) -> bool:
        return mri in {SpanMRI.SELF_TIME.value, SpanMRI.DURATION.value}

    def execute(self, offset, limit):
        builder = self.get_query_builder(offset, limit)
        query_results = builder.run_query(self.referrer.value)
        result = builder.process_results(query_results)
        span_keys = [
            (row["example"][0], row["example"][1], row["example"][2]) for row in result["data"]
        ]
        return self.get_spans_by_key(span_keys)

    def get_query_builder(self, offset: int, limit: int) -> SpansIndexedQueryBuilder:
        rounded_timestamp = f"rounded_timestamp({self.rollup})"

        builder = SpansIndexedQueryBuilder(
            Dataset.SpansIndexed,
            self.params,
            snuba_params=self.snuba_params,
            query=self.query,
            selected_columns=[rounded_timestamp, "example()"],
            limit=limit,
            offset=offset,
        )

        builder.add_conditions(
            [
                # The `00` group is used for spans not used within the
                # new starfish experience. It's effectively the group
                # for other. It is a massive group, so we've chosen
                # to exclude it here.
                #
                # In the future, we will want to look into exposing them
                Condition(builder.column("span.group"), Op.NEQ, "00")
            ]
        )

        return builder


def get_sample_list_executor_cls(mri) -> type[SamplesListExecutor] | None:
    for executor_cls in [SpansSamplesListExecutor]:
        if executor_cls.supports(mri):
            return executor_cls
    return None
