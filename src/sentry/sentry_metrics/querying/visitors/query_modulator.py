from collections.abc import Sequence

from snuba_sdk import AliasedExpression, BooleanCondition, Column, Condition, Formula, Timeseries
from snuba_sdk.expressions import ScalarType

from sentry.models.project import Project
from sentry.sentry_metrics.querying.visitors import QueryConditionVisitor, QueryExpressionVisitor
from sentry.sentry_metrics.querying.visitors.base import TVisited
from sentry.sentry_metrics.querying.visitors.modulator import Modulator


def find_modulator(
    modulators: Sequence[Modulator], from_key: str = None, to_key: str = None
) -> Modulator:
    for modulator in modulators:
        if from_key:
            if modulator.from_key == from_key:
                return modulator
        if to_key:
            if modulator.to_key == to_key:
                return modulator


class ModulatorConditionVisitor(QueryConditionVisitor):
    def __init__(self, projects: Sequence[Project], modulators: Sequence[Modulator]):
        self._projects = projects
        self.modulators = modulators
        self.applied_modulators = []

    def _visit_condition(self, condition: Condition) -> TVisited:
        lhs = condition.lhs
        rhs = condition.rhs

        if isinstance(lhs, Column):
            modulator = find_modulator(self.modulators, lhs.name)
            if modulator:
                new_lhs = Column(modulator.to_key)
                self.applied_modulators.append(modulator)

                if isinstance(rhs, ScalarType):
                    new_rhs = modulator.modulate(rhs, self._projects)
                    return Condition(lhs=new_lhs, op=condition.op, rhs=new_rhs)

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
        self.applied_modulators = []

    def _visit_formula(self, formula: Formula) -> TVisited:
        formula = super()._visit_formula(formula)

        filters = ModulatorConditionVisitor(self._projects, self.modulators).visit_group(
            formula.filters
        )
        formula = formula.set_filters(filters)

        if formula.groupby:
            new_group_bys = []
            for group in formula.groupby:
                new_group = group
                if isinstance(group, Column):
                    modulator = find_modulator(self.modulators, group.name)
                    if modulator:
                        new_group = Column(name=modulator.to_key)
                        self.applied_modulators.append(modulator)
                elif isinstance(group, AliasedExpression):
                    modulator = find_modulator(self.modulators, group.exp.name)
                    if modulator:
                        new_group = AliasedExpression(
                            exp=Column(name=modulator.to_key), alias=group.alias
                        )
                    self.applied_modulators.append(modulator)
                new_group_bys.append(new_group)
            formula = formula.set_groupby(new_group_bys)
        return formula

    def _visit_timeseries(self, timeseries: Timeseries) -> TVisited:
        filters = ModulatorConditionVisitor(self._projects, self.modulators).visit_group(
            timeseries.filters
        )
        timeseries = timeseries.set_filters(filters)

        if timeseries.groupby:
            new_group_bys = []
            for group in timeseries.groupby:
                new_group = group
                if isinstance(group, Column):
                    modulator = find_modulator(self.modulators, group.name)
                    if modulator:
                        new_group = Column(name=modulator.to_key)
                        self.applied_modulators.append(modulator)
                elif isinstance(group, AliasedExpression):
                    modulator = find_modulator(self.modulators, group.exp.name)
                    if modulator:
                        new_group = AliasedExpression(
                            exp=Column(name=modulator.to_key), alias=group.alias
                        )
                    self.applied_modulators.append(modulator)
                new_group_bys.append(new_group)
            timeseries = timeseries.set_groupby(new_group_bys)
        return timeseries
