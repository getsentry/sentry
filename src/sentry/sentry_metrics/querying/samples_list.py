from abc import ABC, abstractmethod
from typing import Any

from sentry.search.events.builder import SpansIndexedQueryBuilder
from sentry.search.events.types import SnubaParams
from sentry.snuba.dataset import Dataset
from sentry.snuba.metrics.naming_layer.mri import (
    SpanMRI,
    TransactionMRI,
    is_measurement,
    is_mri,
    parse_mri,
)
from sentry.snuba.referrer import Referrer


class SamplesListExecutor(ABC):
    def __init__(
        self,
        mri: str,
        params: dict[str, Any],
        snuba_params: SnubaParams,
        query: str | None,
        fields: list[str],
        rollup: int,
        referrer: Referrer,
    ):
        self.mri = mri
        self.params = params
        self.snuba_params = snuba_params
        self.query = query
        self.fields = fields
        self.orderby = "-timestamp"
        self.rollup = rollup
        self.referrer = referrer

    @classmethod
    @abstractmethod
    def supports(cls, metric_mri: str) -> bool:
        raise NotImplementedError

    @abstractmethod
    def execute(self, offset, limit):
        raise NotImplementedError


class TransactionsSamplesListExecutor(SamplesListExecutor):
    @classmethod
    def supports(cls, mri: str) -> bool:
        return mri in {TransactionMRI.DURATION.value}


class SpansSamplesListExecutor(SamplesListExecutor):
    @classmethod
    def supports(cls, mri: str) -> bool:
        return mri in {SpanMRI.SELF_TIME.value, SpanMRI.DURATION.value}

    def execute(self, offset, limit):
        builder = self.get_query_builder(offset, limit)
        query_results = builder.run_query(self.referrer.value)
        return builder.process_results(query_results)

    def get_mri_field(self):
        if self.mri == SpanMRI.SELF_TIME.value:
            return "span.self.time"

        if self.mri == SpanMRI.DURATION.value:
            return "span.duration"

        raise ValueError(f"Unsupported MRI for SpansSamplesListExecutor: {self.mri}")

    def get_query_builder(self, offset: int, limit: int) -> SpansIndexedQueryBuilder:
        fields = self.fields[:]

        # These are fields we always want to return no matter what was selected.
        for field in ["id", "project", "timestamp", self.get_mri_field()]:
            if field not in self.fields:
                fields.append(field)

        return SpansIndexedQueryBuilder(
            Dataset.SpansIndexed,
            self.params,
            snuba_params=self.snuba_params,
            query=self.query,
            selected_columns=fields,
            orderby=self.orderby,
            limit=limit,
            offset=offset,
        )


class MeasurementsSamplesListExecutor(SamplesListExecutor):
    @classmethod
    def supports(cls, mri: str) -> bool:
        parsed_mri = parse_mri(mri)
        return parsed_mri is not None and is_measurement(parsed_mri)


class CustomMetricsSamplesListExecutor(SamplesListExecutor):
    @classmethod
    def supports(cls, mri: str) -> bool:
        return is_mri(mri)


def get_sample_list_executor_cls(mri) -> type[SamplesListExecutor] | None:
    for executor_cls in [SpansSamplesListExecutor]:
        if executor_cls.supports(mri):
            return executor_cls
    return None
