from abc import ABC, abstractmethod
from datetime import datetime
from typing import Any

from snuba_sdk import And, Column, Condition, Function, Op, Or

from sentry import options
from sentry.search.events.builder import (
    MetricsSummariesQueryBuilder,
    QueryBuilder,
    SpansIndexedQueryBuilder,
)
from sentry.search.events.types import QueryBuilderConfig, SnubaParams
from sentry.snuba.dataset import Dataset
from sentry.snuba.metrics.naming_layer.mri import (
    SpanMRI,
    TransactionMRI,
    is_custom_metric,
    is_measurement,
    parse_mri,
)
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
    def supports(cls, mri: str) -> bool:
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

        # This are the additional conditions to better take advantage of the ORDER BY
        # on the spans table. This creates a list of conditions to be `OR`ed together
        # that can will be used by ClickHouse to narrow down the granules.
        #
        # The span ids are not in this condition because they are more effective when
        # specified within the `PREWHERE` clause. So, it's in a separate condition.
        conditions = [
            And(
                [
                    Condition(builder.column("span.group"), Op.EQ, group),
                    Condition(
                        builder.column("timestamp"), Op.EQ, datetime.fromisoformat(timestamp)
                    ),
                ]
            )
            for (group, timestamp, _) in span_ids
        ]

        if len(conditions) == 1:
            order_by_condition = conditions[0]
        else:
            order_by_condition = Or(conditions)

        # Using `IN` combined with putting the list in a SnQL "tuple" triggers an optimizer
        # in snuba where it
        # 1. moves the condition into the `PREWHERE` clause
        # 2. maps the ids to the underlying UInt64 and uses the bloom filter index
        #
        # NOTE: the "tuple" here is critical as without it, snuba will not correctly
        # rewrite the condition and keep it in the WHERE and as a hexidecimal.
        span_id_condition = Condition(
            builder.column("id"),
            Op.IN,
            Function("tuple", [span_id for _, _, span_id in span_ids]),
        )

        builder.add_conditions([order_by_condition, span_id_condition])

        query_results = builder.run_query(self.referrer.value)
        return builder.process_results(query_results)


class SegmentsSamplesListExecutor(SamplesListExecutor):
    @classmethod
    @abstractmethod
    def mri_to_column(cls, mri) -> str | None:
        raise NotImplementedError

    @classmethod
    def supports(cls, mri: str) -> bool:
        return cls.mri_to_column(mri) is not None

    def execute(self, offset, limit):
        span_keys = self.get_span_keys(offset, limit)
        return self.get_spans_by_key(span_keys)

    def get_span_keys(self, offset: int, limit: int) -> list[tuple[str, str, str]]:
        rounded_timestamp = f"rounded_timestamp({self.rollup})"

        """
        When getting examples for a segment, it's actually much faster to read it
        from the transactions dataset compared to the spans dataset as it's a much
        smaller dataset.

        One consideration here is that there is an one to one mapping between a
        transaction to a segment today. If this relationship changes, we'll have to
        rethink how to fetch segment samples a little as the transactions dataset
        may not contain all the necessary data.
        """
        builder = QueryBuilder(
            Dataset.Transactions,
            self.params,
            snuba_params=self.snuba_params,
            query=self.query,
            selected_columns=[rounded_timestamp, "example()"],
            limit=limit,
            offset=offset,
            sample_rate=options.get("metrics.sample-list.sample-rate"),
            config=QueryBuilderConfig(functions_acl=["rounded_timestamp", "example"]),
        )

        builder.add_conditions(self.get_additional_conditions())

        query_results = builder.run_query(self.referrer.value)
        result = builder.process_results(query_results)

        return [
            (
                "00",  # all segments have a group of `00` currently
                row["example"][0],  # timestamp
                row["example"][1],  # span_id
            )
            for row in result["data"]
        ]

    @abstractmethod
    def get_additional_conditions(self) -> list[Condition]:
        raise NotImplementedError


class TransactionDurationSamplesListExecutor(SegmentsSamplesListExecutor):
    @classmethod
    def mri_to_column(cls, mri) -> str | None:
        if mri == TransactionMRI.DURATION.value:
            return "duration"
        return None

    def get_additional_conditions(self) -> list[Condition]:
        return []


class MeasurementsSamplesListExecutor(SegmentsSamplesListExecutor):
    @classmethod
    def mri_to_column(cls, mri) -> str | None:
        name = cls.measurement_name(mri)
        if name is not None:
            return f"measurements[{name}]"

        return None

    @classmethod
    def measurement_name(cls, mri) -> str | None:
        parsed_mri = parse_mri(mri)
        if parsed_mri is not None and is_measurement(parsed_mri):
            return parsed_mri.name[len("measurements:") :]
        return None

    def get_additional_conditions(self) -> list[Condition]:
        name = self.measurement_name(self.mri)
        return [Condition(Function("has", [Column("measurements.key"), name]), Op.EQ, 1)]


class SpansSamplesListExecutor(SamplesListExecutor):
    MRI_MAPPING = {
        SpanMRI.DURATION.value: "span.duration",
        SpanMRI.SELF_TIME.value: "span.self_time",
    }

    @classmethod
    def mri_to_column(cls, mri) -> str | None:
        return cls.MRI_MAPPING.get(mri)

    @classmethod
    def supports(cls, mri: str) -> bool:
        return cls.mri_to_column(mri) is not None

    def execute(self, offset, limit):
        span_keys = self.get_span_keys(offset, limit)
        return self.get_spans_by_key(span_keys)

    def get_span_keys(self, offset: int, limit: int) -> list[tuple[str, str, str]]:
        rounded_timestamp = f"rounded_timestamp({self.rollup})"

        builder = SpansIndexedQueryBuilder(
            Dataset.SpansIndexed,
            self.params,
            snuba_params=self.snuba_params,
            query=self.query,
            selected_columns=[rounded_timestamp, "example()"],
            limit=limit,
            offset=offset,
            sample_rate=options.get("metrics.sample-list.sample-rate"),
            config=QueryBuilderConfig(functions_acl=["rounded_timestamp", "example"]),
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

        query_results = builder.run_query(self.referrer.value)
        result = builder.process_results(query_results)

        return [
            (
                row["example"][0],  # group
                row["example"][1],  # timestamp
                row["example"][2],  # span_id
            )
            for row in result["data"]
        ]


class CustomSamplesListExecutor(SamplesListExecutor):
    @classmethod
    def supports(cls, mri: str) -> bool:
        parsed_mri = parse_mri(mri)
        if parsed_mri is not None and is_custom_metric(parsed_mri):
            return True
        return False

    def execute(self, offset, limit):
        span_keys = self.get_span_keys(offset, limit)
        return self.get_spans_by_key(span_keys)

    def get_span_keys(self, offset: int, limit: int) -> list[tuple[str, str, str]]:
        rounded_timestamp = f"rounded_timestamp({self.rollup})"

        builder = MetricsSummariesQueryBuilder(
            Dataset.MetricsSummaries,
            self.params,
            snuba_params=self.snuba_params,
            query=self.query,
            selected_columns=[rounded_timestamp, "example()"],
            limit=limit,
            offset=offset,
            # This table has a poor SAMPLE BY so DO NOT use it for now
            # sample_rate=options.get("metrics.sample-list.sample-rate"),
            config=QueryBuilderConfig(functions_acl=["rounded_timestamp", "example"]),
        )

        query_results = builder.run_query(self.referrer.value)
        result = builder.process_results(query_results)

        return [
            (
                row["example"][0],  # group
                row["example"][1],  # timestamp
                row["example"][2],  # span_id
            )
            for row in result["data"]
        ]


SAMPLE_LIST_EXECUTORS = [
    SpansSamplesListExecutor,
    TransactionDurationSamplesListExecutor,
    MeasurementsSamplesListExecutor,
    CustomSamplesListExecutor,
]


def get_sample_list_executor_cls(mri) -> type[SamplesListExecutor] | None:
    for executor_cls in SAMPLE_LIST_EXECUTORS:
        if executor_cls.supports(mri):
            return executor_cls
    return None
