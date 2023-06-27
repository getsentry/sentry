from typing import Any, Dict, List, Optional, Protocol

from snuba_sdk import AliasedExpression, And, Column, Condition, CurriedFunction, Op, Or
from snuba_sdk.function import Function

from sentry.api.event_search import SearchFilter, SearchKey, SearchValue
from sentry.discover.arithmetic import categorize_columns
from sentry.search.events.builder import QueryBuilder, TimeseriesQueryBuilder
from sentry.search.events.datasets.profile_functions import ProfileFunctionsDatasetConfig
from sentry.search.events.types import ParamsType, SelectType, SnubaParams, WhereType
from sentry.snuba.dataset import Dataset


class ProfileFunctionsQueryBuilderProtocol(Protocol):
    @property
    def config(self) -> ProfileFunctionsDatasetConfig:
        ...

    @property
    def params(self) -> SnubaParams:
        ...

    def column(self, name: str) -> Column:
        ...


class ProfileFunctionsQueryBuilderMixin:
    def resolve_column_name(self: ProfileFunctionsQueryBuilderProtocol, col: str) -> str:
        # giving resolved a type here convinces mypy that the type is str
        resolved: str = self.config.resolve_column(col)
        return resolved

    def get_field_type(self: ProfileFunctionsQueryBuilderProtocol, field: str) -> Optional[str]:
        # giving resolved a type here convinces mypy that the type is str
        resolved: Optional[str] = self.config.resolve_column_type(field)
        return resolved


class ProfileFunctionsQueryBuilder(ProfileFunctionsQueryBuilderMixin, QueryBuilder):
    function_alias_prefix = "sentry_"


class ProfileFunctionsTimeseriesQueryBuilder(
    ProfileFunctionsQueryBuilderMixin, TimeseriesQueryBuilder
):
    @property
    def time_column(self) -> SelectType:
        return Function(
            "toDateTime",
            [
                Function(
                    "multiply",
                    [
                        Function(
                            "intDiv",
                            [
                                Function("toUInt32", [Column("timestamp")]),
                                self.interval,
                            ],
                        ),
                        self.interval,
                    ],
                ),
            ],
            "time",
        )


class ProfileTopFunctionsTimeseriesQueryBuilder(ProfileFunctionsTimeseriesQueryBuilder):
    def __init__(
        self,
        dataset: Dataset,
        params: ParamsType,
        interval: int,
        top_events: List[Dict[str, Any]],
        other: bool = False,
        query: Optional[str] = None,
        selected_columns: Optional[List[str]] = None,
        timeseries_columns: Optional[List[str]] = None,
        equations: Optional[List[str]] = None,
        functions_acl: Optional[List[str]] = None,
        limit: Optional[int] = 10000,
        skip_tag_resolution: bool = False,
    ):
        selected_columns = [] if selected_columns is None else selected_columns
        timeseries_columns = [] if timeseries_columns is None else timeseries_columns
        _, timeseries_functions = categorize_columns(timeseries_columns)
        super().__init__(
            dataset,
            params,
            interval=interval,
            query=query,
            selected_columns=list(set(selected_columns + timeseries_functions)),
            equations=None,  # TODO: equations are not supported at this time
            functions_acl=functions_acl,
            limit=limit,
            skip_tag_resolution=skip_tag_resolution,
        )

        self.fields = [self.tag_to_prefixed_map.get(c, c) for c in selected_columns]

        if (conditions := self.resolve_top_event_conditions(top_events, other)) is not None:
            self.where.append(conditions)

        if not other:
            self.groupby.extend(
                [column for column in self.columns if column not in self.aggregates]
            )

    @property
    def translated_groupby(self) -> List[str]:
        """Get the names of the groupby columns to create the series names"""
        translated = []
        for groupby in self.groupby:
            if groupby == self.time_column:
                continue
            if isinstance(groupby, (CurriedFunction, AliasedExpression)):
                assert groupby.alias is not None
                translated.append(groupby.alias)
            else:
                translated.append(groupby.name)
        # sorted so the result key is consistent
        return sorted(translated)

    def resolve_top_event_conditions(
        self, top_functions: List[Dict[str, Any]], other: bool
    ) -> Optional[WhereType]:
        assert not other, "Other is not supported"  # TODO: support other

        conditions = []

        # if the project id is in the query, we can further narrow down the
        # list of projects to only the set that matches the top functions
        for field in self.fields:
            if field in ["project", "project.id"] and not other:
                project_condition = [
                    condition
                    for condition in self.where
                    if type(condition) == Condition and condition.lhs == self.column("project_id")
                ][0]
                self.where.remove(project_condition)

                if field == "project":
                    projects = list(
                        {
                            self.params.project_slug_map[function["project"]]
                            for function in top_functions
                        }
                    )
                else:
                    projects = list({function["project.id"] for function in top_functions})
                self.where.append(Condition(self.column("project_id"), Op.IN, projects))

        for function in top_functions:
            terms = [
                SearchFilter(SearchKey(field), "=", SearchValue(function.get(field) or ""))
                for field in self.fields
            ]
            conditions.append(And(self.resolve_where(terms)))

        if len(conditions) > 1:
            return Or(conditions=conditions)
        elif len(conditions) == 1:
            return conditions[0]
        return None
