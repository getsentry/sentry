from collections.abc import Sequence
from dataclasses import replace

from snuba_sdk import AliasedExpression, BooleanCondition, Column, Condition, Formula
from snuba_sdk.expressions import ScalarType

from sentry.models.project import Project
from sentry.sentry_metrics.querying.data.preparation.base import IntermediateQuery, PreparationStep
from sentry.sentry_metrics.querying.visitors import QueryConditionVisitor, QueryExpressionVisitor
from sentry.sentry_metrics.querying.visitors.base import TVisited
from sentry.sentry_metrics.querying.visitors.modulator import Modulator


class ModulationMetadata:
    def __init__(self, from_key: str, to_key: str, from_value: str, to_value: str):
        self.from_key = from_key
        self.to_key = to_key
        self.from_value = from_value
        self.to_value = to_value


def find_modulator(modulators, from_key: str) -> Modulator:
    for modulator in modulators:
        if modulator.from_key == from_key:
            return modulator


class ModulatorConditionVisitor(QueryConditionVisitor):

    # A AND B AND C
    # BooleanCondition(AND, [BooleanCondition(AND, [Condition(A), Condition(B)], Condition(C)])]

    def _visit_condition(self, condition: Condition) -> TVisited:
        lhs = condition.lhs
        rhs = condition.rhs

        if isinstance(lhs, Column):
            modulator = find_modulator(lhs.name)
            lhs = Column(modulator.to_key)

            if isinstance(rhs, ScalarType):
                new_value = modulator.get_new_value(self._projects, rhs)
                rhs = new_value

                return Condition(lhs=lhs, op=condition.op, rhs=rhs)

        return condition

    def _visit_boolean_condition(self, boolean_condition: BooleanCondition) -> TVisited:
        conditions = []
        for condition in boolean_condition.conditions:
            conditions.append(self.visit(condition))

            return BooleanCondition(op=boolean_condition.op, conditions=conditions)


class ModulatorVisitor(QueryExpressionVisitor):
    """
    Visitor that recursively transforms the QueryExpression components to modulate certain attributes to be queried
    by API that need to be translated for Snuba to be able to query the data.
    """

    def __init__(self, projects: Sequence[Project], modulators: Sequence[Modulator]):
        self._projects = projects
        self.modulators = modulators

    def _visit_formula(self, formula: Formula):
        formula = super()._visit_formula(formula)

        filters = ModulatorConditionVisitor().visit_group(formula.filters)
        formula = formula.set_filters(filters)

        groupby = formula.groupby
        if groupby:
            groups = []
            for group in groupby:
                new_group = group
                if isinstance(group, Column):
                    modulator = find_modulator(group.name)
                    new_group = Column(name=modulator.to_key)
                elif isinstance(group, AliasedExpression):
                    modulator = find_modulator(group.exp.name)
                    new_group = AliasedExpression(
                        exp=Column(name=modulator.to_key), alias=group.alias
                    )

                groups.append(new_group)

        formula = formula.set_groupby(groupby)
        return formula


class QueryModulationStep(PreparationStep):
    def __init__(self, modulators: list[Modulator]):
        self.modulators = modulators

    def _get_modulated_intermediate_query(
        self, intermediate_query: IntermediateQuery
    ) -> IntermediateQuery:
        modulators, modulated_query = ModulatorVisitor(self.modulators).visit(
            intermediate_query.metrics_query.query
        )
        if modulators:
            return replace(
                intermediate_query,
                metrics_query=intermediate_query.metrics_query.set_query(modulated_query),
                modulators=modulators,
            )

        return modulated_query

    def run(self, intermediate_queries: list[IntermediateQuery]) -> list[IntermediateQuery]:
        modulated_intermediate_queries = []

        for intermediate_query in intermediate_queries:
            modulated_intermediate_queries.append(
                self._get_modulated_intermediate_query(intermediate_query)
            )

        return modulated_intermediate_queries


class QueryModulatorMetadata:
    def __init__(self, from_key, to_key, from_value, to_value):
        self.from_key = from_key
        self.to_key = to_key
        self.from_value = from_value
        self.to_value = to_value
