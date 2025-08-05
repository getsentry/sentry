from __future__ import annotations

import dataclasses

from snuba_sdk import (
    AliasedExpression,
    Column,
    Condition,
    Direction,
    Entity,
    Flags,
    Join,
    Op,
    OrderBy,
    Query,
    Relationship,
    Request,
)

from sentry.api.issue_search import convert_query_values, convert_status_value
from sentry.search.events.builder.discover import (
    DiscoverQueryBuilder,
    TimeseriesQueryBuilder,
    TopEventsQueryBuilder,
)
from sentry.search.events.filter import ParsedTerms
from sentry.search.events.types import SelectType
from sentry.snuba.entity_subscription import ENTITY_TIME_COLUMNS, get_entity_key_from_query_builder

value_converters = {"status": convert_status_value}


class ErrorsQueryBuilderMixin:
    def __init__(self, *args, **kwargs):
        self.match = None
        self.entities = set()
        super().__init__(*args, **kwargs)

    def parse_query(self, query: str | None) -> ParsedTerms:
        parsed_terms = super().parse_query(query)
        parsed_terms = convert_query_values(
            parsed_terms,
            self.params.projects,
            self.params.user,
            list(filter(None, self.params.environments)),
            value_converters=value_converters,
            allow_aggregate_filters=True,
        )
        return parsed_terms

    def resolve_match(self):
        error_entity = Entity(self.dataset.value, alias=self.dataset.value, sample=self.sample_rate)
        if len(self.entities) == 1:
            self.match = error_entity
        elif len(self.entities) == 2:
            group_entity = Entity("group_attributes", alias="ga")
            self.match = Join([Relationship(error_entity, "attributes", group_entity)])
        else:
            raise Exception("Unexpected number of entities")

    def resolve_params(self):
        conditions = super().resolve_params()
        if len(self.entities) == 2:
            conditions.append(
                Condition(
                    Column("project_id", entity=Entity("group_attributes", alias="ga")),
                    Op.IN,
                    self.params.project_ids,
                )
            )
        return conditions

    def resolve_query(
        self,
        query: str | None = None,
        selected_columns: list[str] | None = None,
        groupby_columns: list[str] | None = None,
        equations: list[str] | None = None,
        orderby: list[str] | str | None = None,
    ) -> None:
        super().resolve_query(query, selected_columns, groupby_columns, equations, orderby)
        self.resolve_match()

    def aliased_column(self, name: str) -> SelectType:
        aliased_col: SelectType = super().aliased_column(name)
        if isinstance(aliased_col, AliasedExpression):
            return dataclasses.replace(
                aliased_col, exp=self._apply_column_entity(aliased_col.exp.name)
            )
        elif isinstance(aliased_col, Column):
            if self.config.use_entity_prefix_for_fields:
                return self._apply_column_entity(aliased_col.name)

            # Map the column with the entity name back to the original resolved name
            return AliasedExpression(
                self._apply_column_entity(aliased_col.name), alias=aliased_col.name
            )

        raise NotImplementedError(f"{type(aliased_col)} not implemented in aliased_column")

    def column(self, name: str) -> Column:
        """Given an unresolved sentry column name and return a snql column.

        :param name: The unresolved sentry name.
        """
        resolved_column = self.resolve_column_name(name)
        return self._apply_column_entity(resolved_column)

    def _apply_column_entity(self, resolved_column: str) -> Column:
        if resolved_column == "status":
            resolved_column = f"group_{resolved_column}"
            entity = Entity("group_attributes", alias="ga")
        else:
            entity = Entity(self.dataset.value, alias=self.dataset.value)
        self.entities.add(entity)
        return Column(resolved_column, entity=entity)


class ErrorsQueryBuilder(ErrorsQueryBuilderMixin, DiscoverQueryBuilder):
    def get_snql_query(self) -> Request:
        self.validate_having_clause()
        return Request(
            dataset=self.dataset.value,
            app_id="errors",
            query=Query(
                match=self.match,
                select=self.columns,
                array_join=self.array_join,
                where=self.where,
                having=self.having,
                groupby=self.groupby,
                orderby=self.orderby,
                limit=self.limit,
                offset=self.offset,
                limitby=self.limitby,
            ),
            flags=Flags(turbo=self.turbo),
            tenant_ids=self.tenant_ids,
        )

    def add_conditions(self, conditions: list[Condition]) -> None:
        """
        Override the base implementation to add entity data
        """
        entity_key = get_entity_key_from_query_builder(self)
        time_col = ENTITY_TIME_COLUMNS[entity_key]
        entity = Entity(entity_key.value, alias="events")
        new_conditions = []
        for condition in conditions:
            column = Column(time_col, entity=entity)
            new_conditions.append(Condition(column, condition.op, condition.rhs))
        self.where += new_conditions


class ErrorsTimeseriesQueryBuilder(ErrorsQueryBuilderMixin, TimeseriesQueryBuilder):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

    @property
    def time_column(self) -> SelectType:
        return Column("time", entity=Entity(self.dataset.value, alias=self.dataset.value))

    def get_snql_query(self) -> Request:
        return Request(
            dataset=self.dataset.value,
            app_id="errors",
            query=Query(
                match=self.match,
                select=self.select,
                where=self.where,
                having=self.having,
                groupby=self.groupby,
                orderby=[OrderBy(self.time_column, Direction.ASC)],
                granularity=self.granularity,
                limit=self.limit,
            ),
            tenant_ids=self.tenant_ids,
        )


class ErrorsTopEventsQueryBuilder(ErrorsQueryBuilderMixin, TopEventsQueryBuilder):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

    @property
    def time_column(self) -> SelectType:
        return Column("time", entity=Entity(self.dataset.value, alias=self.dataset.value))

    def get_snql_query(self) -> Request:
        return Request(
            dataset=self.dataset.value,
            app_id="errors",
            query=Query(
                match=self.match,
                select=self.select,
                where=self.where,
                having=self.having,
                groupby=self.groupby,
                orderby=[OrderBy(self.time_column, Direction.ASC)],
                granularity=self.granularity,
                limit=self.limit,
            ),
            tenant_ids=self.tenant_ids,
        )
