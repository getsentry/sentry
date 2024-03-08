from abc import ABC, abstractmethod
from bisect import bisect
from collections.abc import Callable
from datetime import datetime
from typing import Any, Literal, TypedDict, cast

from snuba_sdk import And, Column, Condition, Function, Op, Or

from sentry import options
from sentry.api.event_search import SearchFilter, SearchKey, SearchValue
from sentry.search.events.builder import (
    MetricsSummariesQueryBuilder,
    QueryBuilder,
    SpansIndexedQueryBuilder,
)
from sentry.search.events.types import ParamsType, QueryBuilderConfig, SelectType, SnubaParams
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
    # picking 30 samples gives a decent chance to surface a few samples from the higher percentiles
    num_samples = 30

    sortable_columns = {"timestamp", "span.duration"}

    def __init__(
        self,
        mri: str,
        params: ParamsType,
        snuba_params: SnubaParams,
        fields: list[str],
        operation: str | None,
        query: str | None,
        min: float | None,
        max: float | None,
        sort: str | None,
        rollup: int,
        referrer: Referrer,
    ):
        self.mri = mri
        self.params = params
        self.snuba_params = snuba_params
        self.fields = fields
        self.operation = operation
        self.query = query
        self.min = min
        self.max = max
        self.sort = sort
        self.rollup = rollup
        self.referrer = referrer

    @classmethod
    @abstractmethod
    def supports_mri(cls, mri: str) -> bool:
        raise NotImplementedError

    @classmethod
    def supports_sort(cls, column: str) -> bool:
        return column in cls.sortable_columns

    def execute(self, offset, limit):
        if self.sort is None:
            execute_fn = self.execute_unsorted
        else:
            execute_fn = self.execute_sorted
        return execute_fn(offset, limit)

    @abstractmethod
    def execute_sorted(self, offset, limit):
        raise NotImplementedError

    @abstractmethod
    def execute_unsorted(self, offset, limit):
        raise NotImplementedError

    def get_spans_by_key(
        self,
        span_ids: list[tuple[str, str, str]],
        additional_fields: list[str] | None = None,
    ):
        if not span_ids:
            return {"data": []}

        fields = self.fields[:]
        if additional_fields is not None:
            fields.extend(additional_fields)

        builder = SpansIndexedQueryBuilder(
            Dataset.SpansIndexed,
            self.params,
            snuba_params=self.snuba_params,
            selected_columns=fields,
            orderby=self.sort,
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
    SORT_MAPPING = {
        "span.duration": "transaction.duration",
        "timestamp": "timestamp",
    }

    @classmethod
    @abstractmethod
    def mri_to_column(cls, mri: str) -> str | None:
        raise NotImplementedError

    @classmethod
    def convert_sort(cls, sort) -> tuple[Literal["", "-"], str] | None:
        direction: Literal["", "-"] = ""
        if sort.startswith("-"):
            direction = "-"
            sort = sort[1:]
        if sort in cls.SORT_MAPPING:
            return direction, cls.SORT_MAPPING[sort]
        return None

    @classmethod
    def supports_mri(cls, mri: str) -> bool:
        return cls.mri_to_column(mri) is not None

    def _get_spans(
        self,
        span_keys: list[tuple[str, str, str]],
        summaries: dict[str, Summary],
    ):
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

    def execute_sorted(self, offset, limit):
        span_keys, summaries = self.get_sorted_span_keys(offset, limit)
        return self._get_spans(span_keys, summaries)

    def get_sorted_span_keys(
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
        sort = self.convert_sort(self.sort)
        assert sort is not None
        direction, sort_column = sort

        mri_column = self.mri_to_column(self.mri)
        assert mri_column is not None

        fields = ["span_id", "timestamp"]
        if sort_column not in fields:
            fields.append(sort_column)
        if mri_column not in fields:
            fields.append(mri_column)

        builder = QueryBuilder(
            Dataset.Transactions,
            self.params,
            snuba_params=self.snuba_params,
            query=self.query,
            selected_columns=fields,
            orderby=f"{direction}{sort_column}",
            limit=limit,
            offset=offset,
        )

        additional_conditions = self.get_additional_conditions(builder)
        min_max_conditions = self.get_min_max_conditions(builder.column(mri_column))
        builder.add_conditions([*additional_conditions, *min_max_conditions])

        query_results = builder.run_query(self.referrer.value)
        result = builder.process_results(query_results)

        span_keys = [
            (
                "00",  # all segments have a group of `00` currently
                row["timestamp"],  # timestamp
                row["span_id"],  # span_id
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
            cast(str, row["span_id"]): cast(
                Summary,
                {
                    "min": row[mri_column],
                    "max": row[mri_column],
                    "sum": row[mri_column],
                    "count": 1,
                },
            )
            for row in result["data"]
        }

        return span_keys, summaries

    def execute_unsorted(self, offset, limit):
        span_keys, summaries = self.get_unsorted_span_keys(offset, limit)
        return self._get_spans(span_keys, summaries)

    def get_unsorted_span_keys(
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
                f"examples({column}, {self.num_samples}) AS examples",
            ],
            limit=limit,
            offset=offset,
            sample_rate=options.get("metrics.sample-list.sample-rate"),
            config=QueryBuilderConfig(functions_acl=["rounded_timestamp", "examples"]),
        )

        additional_conditions = self.get_additional_conditions(builder)
        min_max_conditions = self.get_min_max_conditions(builder.column(column))
        builder.add_conditions([*additional_conditions, *min_max_conditions])

        query_results = builder.run_query(self.referrer.value)
        result = builder.process_results(query_results)

        metric_key = lambda example: example[2]  # sort by metric
        for row in result["data"]:
            row["examples"] = pick_samples(row["examples"], metric_key=metric_key)

        span_keys = [
            (
                "00",  # all segments have a group of `00` currently
                example[0],  # timestamp
                example[1],  # span_id
            )
            for row in result["data"]
            for example in row["examples"]
        ][:limit]

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
            cast(str, example[1]): cast(
                Summary,
                {
                    "min": example[2],
                    "max": example[2],
                    "sum": example[2],
                    "count": 1,
                },
            )
            for row in result["data"]
            for example in row["examples"]
        }

        return span_keys, summaries

    def get_additional_conditions(self, builder: QueryBuilder) -> list[Condition]:
        raise NotImplementedError

    def get_min_max_conditions(self, column: Column) -> list[Condition]:
        conditions = []

        if self.min is not None:
            conditions.append(Condition(column, Op.GTE, self.min))
        if self.max is not None:
            conditions.append(Condition(column, Op.LTE, self.max))

        return conditions


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
        name = cls.mri_to_measurement_name(mri)
        if name is not None:
            return f"measurements.{name}"

        return None

    @classmethod
    def mri_to_measurement_name(cls, mri) -> str | None:
        parsed_mri = parse_mri(mri)
        if parsed_mri is not None and is_measurement(parsed_mri):
            return parsed_mri.name[len("measurements:") :]
        return None

    def get_additional_conditions(self, builder: QueryBuilder) -> list[Condition]:
        name = self.mri_to_measurement_name(self.mri)
        return [Condition(Function("has", [Column("measurements.key"), name]), Op.EQ, 1)]


class SpansSamplesListExecutor(AbstractSamplesListExecutor):
    @classmethod
    @abstractmethod
    def mri_to_column(cls, mri) -> str | None:
        raise NotImplementedError

    @classmethod
    def supports_mri(cls, mri: str) -> bool:
        return cls.mri_to_column(mri) is not None

    def execute_sorted(self, offset, limit):
        """
        Since we're already querying the spans table sorted on some column,
        there's no reason to split this into 2 queries. We can go ahead and
        just do it all in a single query.
        """
        fields = self.fields[:]

        column = self.mri_to_column(self.mri)
        assert column is not None
        if column not in fields:
            fields.append(column)

        builder = SpansIndexedQueryBuilder(
            Dataset.SpansIndexed,
            self.params,
            snuba_params=self.snuba_params,
            selected_columns=fields,
            orderby=self.sort,
            limit=limit,
            offset=0,
        )

        additional_conditions = self.get_additional_conditions(builder)

        min_max_conditions = self.get_min_max_conditions(builder.resolve_column(column))

        builder.add_conditions([*additional_conditions, *min_max_conditions])

        query_results = builder.run_query(self.referrer.value)
        result = builder.process_results(query_results)

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

    def execute_unsorted(self, offset, limit):
        span_keys = self.get_unsorted_span_keys(offset, limit)

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

    def get_unsorted_span_keys(self, offset: int, limit: int) -> list[tuple[str, str, str]]:
        column = self.mri_to_column(self.mri)

        builder = SpansIndexedQueryBuilder(
            Dataset.SpansIndexed,
            self.params,
            snuba_params=self.snuba_params,
            query=self.query,
            selected_columns=[
                f"rounded_timestamp({self.rollup})",
                f"examples({column}, {self.num_samples}) AS examples",
            ],
            limit=limit,
            offset=offset,
            sample_rate=options.get("metrics.sample-list.sample-rate"),
            config=QueryBuilderConfig(functions_acl=["rounded_timestamp", "examples"]),
        )

        additional_conditions = self.get_additional_conditions(builder)

        assert column is not None
        min_max_conditions = self.get_min_max_conditions(builder.resolve_column(column))

        builder.add_conditions([*additional_conditions, *min_max_conditions])

        query_results = builder.run_query(self.referrer.value)
        result = builder.process_results(query_results)

        metric_key = lambda example: example[3]  # sort by metric
        for row in result["data"]:
            row["examples"] = pick_samples(row["examples"], metric_key=metric_key)

        return [
            (
                example[0],  # group
                example[1],  # timestamp
                example[2],  # span_id
            )
            for row in result["data"]
            for example in row["examples"]
        ][:limit]

    @abstractmethod
    def get_additional_conditions(self, builder: QueryBuilder) -> list[Condition]:
        raise NotImplementedError

    def get_min_max_conditions(self, column: SelectType) -> list[Condition]:
        conditions = []

        if self.min is not None:
            conditions.append(Condition(column, Op.GTE, self.min))
        if self.max is not None:
            conditions.append(Condition(column, Op.LTE, self.max))

        return conditions


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
        name = cls.mri_measurement_name(mri)
        if name is not None:
            return f"measurements.{name}"

        return None

    @classmethod
    def mri_measurement_name(cls, mri) -> str | None:
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
        name = self.mri_measurement_name(self.mri)
        return [Condition(Function("has", [Column("measurements.key"), name]), Op.EQ, 1)]


class CustomSamplesListExecutor(AbstractSamplesListExecutor):
    SORT_MAPPING = {
        "span.duration": "span.duration",
        "timestamp": "timestamp",
    }

    MIN_MAX_CONDITION_COLUMN = {
        "min": "min_metric",
        "max": "max_metric",
        "count": "count_metric",
    }

    # refer to the definition of `examples()` in the metrics summary dataset
    EXAMPLES_SORT_KEY = {
        "min": 3,
        "max": 4,
        "count": 6,
    }

    @classmethod
    def convert_sort(cls, sort) -> tuple[Literal["", "-"], str] | None:
        direction: Literal["", "-"] = ""
        if sort.startswith("-"):
            direction = "-"
            sort = sort[1:]
        if sort in cls.SORT_MAPPING:
            return direction, cls.SORT_MAPPING[sort]
        return None

    @classmethod
    def supports_mri(cls, mri: str) -> bool:
        parsed_mri = parse_mri(mri)
        if parsed_mri is not None and is_custom_metric(parsed_mri):
            return True
        return False

    def _get_spans(
        self,
        span_keys: list[tuple[str, str, str]],
        summaries: dict[str, Summary],
    ):
        result = self.get_spans_by_key(span_keys, additional_fields=["id"])

        should_pop_id = "id" not in self.fields

        for row in result["data"]:
            span_id = row.pop("id") if should_pop_id else row["id"]
            row["summary"] = summaries[span_id]

        return result

    def execute_sorted(self, offset, limit):
        span_keys, summaries = self.get_sorted_span_keys(offset, limit)
        return self._get_spans(span_keys, summaries)

    def get_sorted_span_keys(
        self,
        offset: int,
        limit: int,
    ) -> tuple[list[tuple[str, str, str]], dict[str, Summary]]:
        sort = self.convert_sort(self.sort)
        assert sort is not None
        direction, sort_column = sort

        fields = ["id", "timestamp", "span.group", "min", "max", "sum", "count"]
        if sort_column not in fields:
            fields.append(sort_column)

        builder = MetricsSummariesQueryBuilder(
            Dataset.MetricsSummaries,
            self.params,
            snuba_params=self.snuba_params,
            query=self.query,
            selected_columns=fields,
            orderby=self.sort,
            limit=limit,
            offset=offset,
            # This table has a poor SAMPLE BY so DO NOT use it for now
            # sample_rate=options.get("metrics.sample-list.sample-rate"),
            config=QueryBuilderConfig(functions_acl=["rounded_timestamp", "example"]),
        )

        additional_conditions = self.get_additional_conditions(builder)
        min_max_conditions = self.get_min_max_conditions(builder)
        builder.add_conditions([*additional_conditions, *min_max_conditions])

        query_results = builder.run_query(self.referrer.value)
        result = builder.process_results(query_results)

        span_keys = [
            (
                cast(str, row["span.group"]),  # group
                cast(str, row["timestamp"]),  # timestamp
                cast(str, row["id"]),  # span_id
            )
            for row in result["data"]
        ]

        """
        The indexed spans dataset does not contain any metric related
        data. To propagate these values, we read it from the metric
        summaries table, and copy them to the results in the next step.
        """
        summaries = {
            cast(str, row["id"]): cast(
                Summary,
                {
                    "min": row["min"],
                    "max": row["max"],
                    "sum": row["sum"],
                    "count": row["count"],
                },
            )
            for row in result["data"]
        }

        return span_keys, summaries

    def execute_unsorted(self, offset, limit):
        span_keys, summaries = self.get_unsorted_span_keys(offset, limit)
        return self._get_spans(span_keys, summaries)

    def get_unsorted_span_keys(
        self,
        offset: int,
        limit: int,
    ) -> tuple[list[tuple[str, str, str]], dict[str, Summary]]:
        builder = MetricsSummariesQueryBuilder(
            Dataset.MetricsSummaries,
            self.params,
            snuba_params=self.snuba_params,
            query=self.query,
            selected_columns=[
                f"rounded_timestamp({self.rollup})",
                f"examples({self.num_samples}) AS examples",
            ],
            limit=limit,
            offset=offset,
            # This table has a poor SAMPLE BY so DO NOT use it for now
            # sample_rate=options.get("metrics.sample-list.sample-rate"),
            config=QueryBuilderConfig(functions_acl=["rounded_timestamp", "examples"]),
        )

        additional_conditions = self.get_additional_conditions(builder)
        min_max_conditions = self.get_min_max_conditions(builder)
        builder.add_conditions([*additional_conditions, *min_max_conditions])

        query_results = builder.run_query(self.referrer.value)
        result = builder.process_results(query_results)

        # 7 here refers to the avg value which is the default
        # if the operaton doesn't have metric it should sort by
        index = self.EXAMPLES_SORT_KEY.get(self.operation or "", 7)  # sort by metric
        metric_key = lambda example: example[index]

        for row in result["data"]:
            row["examples"] = pick_samples(row["examples"], metric_key=metric_key)

        span_keys = [
            (
                cast(str, example[0]),  # group
                cast(str, example[1]),  # timestamp
                cast(str, example[2]),  # span_id
            )
            for row in result["data"]
            for example in row["examples"]
        ][:limit]

        """
        The indexed spans dataset does not contain any metric related
        data. To propagate these values, we read it from the metric
        summaries table, and copy them to the results in the next step.
        """
        summaries = {
            cast(str, example[2]): cast(
                Summary,
                {
                    "min": example[3],
                    "max": example[4],
                    "sum": example[5],
                    "count": example[6],
                },
            )
            for row in result["data"]
            for example in row["examples"]
        }

        return span_keys, summaries

    def get_additional_conditions(self, builder: QueryBuilder) -> list[Condition]:
        return [
            builder.convert_search_filter_to_condition(
                SearchFilter(SearchKey("metric"), "=", SearchValue(self.mri)),
            )
        ]

    def get_min_max_conditions(self, builder: QueryBuilder) -> list[Condition]:
        conditions = []

        column = builder.resolve_column(
            self.MIN_MAX_CONDITION_COLUMN.get(self.operation or "", "avg_metric")
        )

        if self.min is not None:
            conditions.append(Condition(column, Op.GTE, self.min))
        if self.max is not None:
            conditions.append(Condition(column, Op.LTE, self.max))

        return conditions


SAMPLE_LIST_EXECUTORS = [
    TransactionDurationSamplesListExecutor,
    TransactionMeasurementsSamplesListExecutor,
    SpansTimingsSamplesListExecutor,
    SpansMeasurementsSamplesListExecutor,
    CustomSamplesListExecutor,
]


def get_sample_list_executor_cls(mri) -> type[AbstractSamplesListExecutor] | None:
    for executor_cls in SAMPLE_LIST_EXECUTORS:
        if executor_cls.supports_mri(mri):
            return executor_cls
    return None


def pick_samples(
    samples: list[Any],
    metric_key: Callable[[Any], float],
) -> list[Any]:
    # if there are at most 3 samples, there's no picking needed
    # as we want to return at most 3 from the list provided
    if len(samples) <= 3:
        return samples

    samples.sort(key=metric_key)

    keys = [metric_key(sample) for sample in samples]

    # first element is the one near the average
    # but must not be the first or last element
    avg_m = sum(keys) / len(keys)
    idx_m = bisect(keys, avg_m)
    # ensure there is at least 1 element on both sides
    # of the middle element we just picked
    # i.e. should not pick index 0 and len(keys) - 1
    idx_m = _clip(idx_m, 1, len(keys) - 2)

    # second element is near the average of first
    # split, but must not be the split element
    avg_l = sum(keys[:idx_m]) / idx_m
    idx_l = bisect(keys, avg_l, hi=idx_m - 1)
    idx_l += 1  # push it closer to the middle
    # ensure this is not the same as middle element
    idx_l = _clip(idx_l, 0, idx_m - 1)

    # third element is near the average of second
    # split, but must not be the split element
    avg_r = sum(keys[idx_m + 1 :]) / (len(keys) - idx_m - 1)
    idx_r = bisect(keys, avg_r, lo=idx_m + 1)
    idx_r -= 1  # push it closer to the middle
    # ensure this is not the same as middle element
    idx_r = _clip(idx_r, idx_m + 1, len(keys) - 1)

    return [samples[idx_m], samples[idx_l], samples[idx_r]]


def _clip(val: int, left: int, right: int) -> int:
    val = max(left, val)
    val = min(val, right)
    return val
