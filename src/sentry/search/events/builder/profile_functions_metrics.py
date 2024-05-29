from snuba_sdk import Condition, Granularity

from sentry.search.events.builder import (
    MetricsQueryBuilder,
    TimeseriesMetricQueryBuilder,
    TopMetricsQueryBuilder,
)
from sentry.search.events.types import SelectType


class ProfileFunctionsMetricsQueryBuilder(MetricsQueryBuilder):
    requires_organization_condition = True
    profile_functions_metrics_builder = True

    column_remapping = {
        # We want to remap `message` to `name` for the free
        # text search use case so that it searches the `name`
        # (function name) when the user performs a free text search
        "message": "name",
    }

    @property
    def use_default_tags(self) -> bool:
        return False

    def get_field_type(self, field: str) -> str | None:
        if field in self.meta_resolver_map:
            return self.meta_resolver_map[field]
        return None

    def resolve_select(
        self, selected_columns: list[str] | None, equations: list[str] | None
    ) -> list[SelectType]:
        if selected_columns and "transaction" in selected_columns:
            self.has_transaction = True  # if always true can we skip this?
        return super().resolve_select(selected_columns, equations)


class TimeseriesProfileFunctionsMetricsQueryBuilder(
    ProfileFunctionsMetricsQueryBuilder, TimeseriesMetricQueryBuilder
):
    def resolve_split_granularity(self) -> tuple[list[Condition], Granularity | None]:
        """Don't do this for timeseries"""
        return [], self.granularity


class TopProfileFunctionsMetricsQueryBuilder(
    TimeseriesProfileFunctionsMetricsQueryBuilder, TopMetricsQueryBuilder
):
    pass
