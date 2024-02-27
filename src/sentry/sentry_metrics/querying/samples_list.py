from abc import ABC, abstractmethod
from datetime import datetime
from typing import TypedDict, cast

from snuba_sdk import And, Column, Condition, Function, Op, Or

from sentry import options
from sentry.api.event_search import SearchFilter, SearchKey, SearchValue
from sentry.search.events.builder import (
    MetricsSummariesQueryBuilder,
    QueryBuilder,
    SpansIndexedQueryBuilder,
)
from sentry.search.events.types import ParamsType, QueryBuilderConfig, SnubaParams
from sentry.snuba.dataset import Dataset
from sentry.snuba.metrics.naming_layer.mri import (
    SpanMRI,
    TransactionMRI,
    is_custom_metric,
    is_measurement,
    parse_mri,
)
from sentry.snuba.referrer import Referrer


class Summary(TypedDict):
    min: float
    max: float
    sum: float
    count: int


class AbstractSamplesListExecutor(ABC):
    def __init__(
        self,
        mri: str,
        params: ParamsType,
        snuba_params: SnubaParams,
        fields: list[str],
        query: str | None,
        min: float | None,
        max: float | None,
        rollup: int,
        referrer: Referrer,
    ):
        self.mri = mri
        self.params = params
        self.snuba_params = snuba_params
        self.fields = fields
        self.query = query
        self.min = min
        self.max = max
        self.rollup = rollup
        self.referrer = referrer

    @classmethod
    @abstractmethod
    def supports(cls, mri: str) -> bool:
        raise NotImplementedError

    @abstractmethod
    def execute(self, offset, limit):
        raise NotImplementedError

    def get_spans_by_key(
        self, span_ids: list[tuple[str, str, str]], additional_fields: list[str] | None = None
    ):
        if not span_ids:
            return {"data": []}

        fields = self.fields
        if additional_fields is not None:
            fields += additional_fields

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


class SegmentsSamplesListExecutor(AbstractSamplesListExecutor):
    @classmethod
    @abstractmethod
    def mri_to_column(cls, mri: str) -> str | None:
        raise NotImplementedError

    @classmethod
    def supports(cls, mri: str) -> bool:
        return cls.mri_to_column(mri) is not None

    def execute(self, offset, limit):
        span_keys, summaries = self.get_span_keys(offset, limit)
        result = self.get_spans_by_key(
            span_keys,
            # force `id` to be one of the fields
            additional_fields=["id"],
        )

        # if `id` wasn't initially there, we should remove it
        should_pop_id = "id" not in self.fields

        for row in result["data"]:
            span_id = row.pop("id") if should_pop_id else row["id"]
            row["summary"] = summaries[span_id]

        return result

    def get_span_keys(
        self,
        offset: int,
        limit: int,
    ) -> tuple[list[tuple[str, str, str]], dict[str, Summary]]:
        """
        When getting examples for a segment, it's actually much faster to read it
        from the transactions dataset compared to the spans dataset as it's a much
        smaller dataset.

        One consideration here is that there is an one to one mapping between a
        transaction to a segment today. If this relationship changes, we'll have to
        rethink how to fetch segment samples a little as the transactions dataset
        may not contain all the necessary data.
        """
        column = self.mri_to_column(self.mri)
        assert column is not None

        builder = QueryBuilder(
            Dataset.Transactions,
            self.params,
            snuba_params=self.snuba_params,
            query=self.query,
            selected_columns=[
                f"rounded_timestamp({self.rollup})",
                f"example({column}) AS example",
            ],
            limit=limit,
            offset=offset,
            sample_rate=options.get("metrics.sample-list.sample-rate"),
            config=QueryBuilderConfig(functions_acl=["rounded_timestamp", "example"]),
        )

        additional_conditions = self.get_additional_conditions(builder)

        if self.min is not None:
            additional_conditions.append(Condition(builder.column(column), Op.GTE, self.min))
        if self.max is not None:
            additional_conditions.append(Condition(builder.column(column), Op.LTE, self.max))

        builder.add_conditions(additional_conditions)

        query_results = builder.run_query(self.referrer.value)
        result = builder.process_results(query_results)

        span_keys = [
            (
                "00",  # all segments have a group of `00` currently
                row["example"][0],  # timestamp
                row["example"][1],  # span_id
            )
            for row in result["data"]
        ]

        """
        Because transaction level measurements currently do not get
        propagated to the spans dataset, we have to query them here,
        generate the summary for it here, and propagate it to the
        results of the next stage.

        Once we start writing transaction level measurements to the
        indexed spans dataset, we can stop doing this and read the
        value directly from the indexed spans dataset.

        For simplicity, all transaction based metrics use this approach.
        """
        summaries = {
            cast(str, row["example"][1]): cast(
                Summary,
                {
                    "min": row["example"][2],
                    "max": row["example"][2],
                    "sum": row["example"][2],
                    "count": 1,
                },
            )
            for row in result["data"]
        }

        return span_keys, summaries

    @abstractmethod
    def get_additional_conditions(self, builder: QueryBuilder) -> list[Condition]:
        raise NotImplementedError


class TransactionDurationSamplesListExecutor(SegmentsSamplesListExecutor):
    @classmethod
    def mri_to_column(cls, mri: str) -> str | None:
        if mri == TransactionMRI.DURATION.value:
            # Because we read this from the transactions dataset,
            # we use the name for the transactions dataset instead.
            return "transaction.duration"
        return None

    def get_additional_conditions(self, builder: QueryBuilder) -> list[Condition]:
        return []


class TransactionMeasurementsSamplesListExecutor(SegmentsSamplesListExecutor):
    @classmethod
    def mri_to_column(cls, mri) -> str | None:
        name = cls.measurement_name(mri)
        if name is not None:
            return f"measurements.{name}"

        return None

    @classmethod
    def measurement_name(cls, mri) -> str | None:
        parsed_mri = parse_mri(mri)
        if parsed_mri is not None and is_measurement(parsed_mri):
            return parsed_mri.name[len("measurements:") :]
        return None

    def get_additional_conditions(self, builder: QueryBuilder) -> list[Condition]:
        name = self.measurement_name(self.mri)
        return [Condition(Function("has", [Column("measurements.key"), name]), Op.EQ, 1)]


class SpansSamplesListExecutor(AbstractSamplesListExecutor):
    @classmethod
    @abstractmethod
    def mri_to_column(cls, mri) -> str | None:
        raise NotImplementedError

    @classmethod
    def supports(cls, mri: str) -> bool:
        return cls.mri_to_column(mri) is not None

    def execute(self, offset, limit):
        span_keys = self.get_span_keys(offset, limit)

        column = self.mri_to_column(self.mri)
        assert column is not None  # should always resolve to a column here

        result = self.get_spans_by_key(span_keys, additional_fields=[column])

        should_pop_column = column not in self.fields

        for row in result["data"]:
            value = row.pop(column) if should_pop_column else row[column]
            row["summary"] = {
                "min": value,
                "max": value,
                "sum": value,
                "count": 1,
            }

        return result

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

        additional_conditions = self.get_additional_conditions(builder)

        column = self.mri_to_column(self.mri)
        assert column is not None

        if self.min is not None:
            additional_conditions.append(Condition(builder.column(column), Op.GTE, self.min))
        if self.max is not None:
            additional_conditions.append(Condition(builder.column(column), Op.LTE, self.max))

        builder.add_conditions(additional_conditions)

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

    @abstractmethod
    def get_additional_conditions(self, builder: QueryBuilder) -> list[Condition]:
        raise NotImplementedError


class SpansTimingsSamplesListExecutor(SpansSamplesListExecutor):
    MRI_MAPPING = {
        SpanMRI.DURATION.value: "span.duration",
        SpanMRI.SELF_TIME.value: "span.self_time",
    }

    @classmethod
    def mri_to_column(cls, mri) -> str | None:
        return cls.MRI_MAPPING.get(mri)

    def get_additional_conditions(self, builder: QueryBuilder) -> list[Condition]:
        return [
            # The `00` group is used for spans not used within the
            # new starfish experience. It's effectively the group
            # for other. It is a massive group, so we've chosen
            # to exclude it here.
            #
            # In the future, we will want to look into exposing them
            Condition(builder.column("span.group"), Op.NEQ, "00")
        ]


class SpansMeasurementsSamplesListExecutor(SpansSamplesListExecutor):
    # These are some hard coded metrics in the spans name space that can be
    # queried in the measurements of the indexed spans dataset
    MRI_MAPPING = {
        SpanMRI.RESPONSE_CONTENT_LENGTH.value: "http.response_content_length",
        SpanMRI.DECODED_RESPONSE_CONTENT_LENGTH.value: "http.decoded_response_content_length",
        SpanMRI.RESPONSE_TRANSFER_SIZE.value: "http.response_transfer_size",
    }

    @classmethod
    def mri_to_column(cls, mri) -> str | None:
        name = cls.measurement_name(mri)
        if name is not None:
            return f"measurements.{name}"

        return None

    @classmethod
    def measurement_name(cls, mri) -> str | None:
        if name := cls.MRI_MAPPING.get(mri):
            return name

        # some web vitals exist on spans
        parsed_mri = parse_mri(mri)
        if (
            parsed_mri is not None
            and parsed_mri.namespace == "spans"
            and parsed_mri.name.startswith("webvital.")
        ):
            return parsed_mri.name[len("webvital:") :]

        return None

    def get_additional_conditions(self, builder: QueryBuilder) -> list[Condition]:
        name = self.measurement_name(self.mri)
        return [Condition(Function("has", [Column("measurements.key"), name]), Op.EQ, 1)]


class CustomSamplesListExecutor(AbstractSamplesListExecutor):
    @classmethod
    def supports(cls, mri: str) -> bool:
        parsed_mri = parse_mri(mri)
        if parsed_mri is not None and is_custom_metric(parsed_mri):
            return True
        return False

    def execute(self, offset, limit):
        span_keys, summaries = self.get_span_keys(offset, limit)
        result = self.get_spans_by_key(span_keys, additional_fields=["id"])

        should_pop_id = "id" not in self.fields

        for row in result["data"]:
            span_id = row.pop("id") if should_pop_id else row["id"]
            row["summary"] = summaries[span_id]

        return result

    def get_span_keys(
        self,
        offset: int,
        limit: int,
    ) -> tuple[list[tuple[str, str, str]], dict[str, Summary]]:
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

        additional_conditions = [
            builder.convert_search_filter_to_condition(
                SearchFilter(SearchKey("metric"), "=", SearchValue(self.mri)),
            )
        ]

        if self.min is not None:
            additional_conditions.append(Condition(Column("min"), Op.GTE, self.min))
        if self.max is not None:
            additional_conditions.append(Condition(Column("max"), Op.LTE, self.max))

        builder.add_conditions(additional_conditions)

        query_results = builder.run_query(self.referrer.value)
        result = builder.process_results(query_results)

        span_keys = [
            (
                cast(str, row["example"][0]),  # group
                cast(str, row["example"][1]),  # timestamp
                cast(str, row["example"][2]),  # span_id
            )
            for row in result["data"]
        ]

        """
        The indexed spans dataset does not contain any metric related
        data. To propagate these values, we read it from the metric
        summaries table, and copy them to the results in the next step.
        """
        summaries = {
            cast(str, row["example"][2]): cast(
                Summary,
                {
                    "min": row["example"][3],
                    "max": row["example"][4],
                    "sum": row["example"][5],
                    "count": row["example"][6],
                },
            )
            for row in result["data"]
        }

        return span_keys, summaries


SAMPLE_LIST_EXECUTORS = [
    TransactionDurationSamplesListExecutor,
    TransactionMeasurementsSamplesListExecutor,
    SpansTimingsSamplesListExecutor,
    SpansMeasurementsSamplesListExecutor,
    CustomSamplesListExecutor,
]


def get_sample_list_executor_cls(mri) -> type[AbstractSamplesListExecutor] | None:
    for executor_cls in SAMPLE_LIST_EXECUTORS:
        if executor_cls.supports(mri):
            return executor_cls
    return None
