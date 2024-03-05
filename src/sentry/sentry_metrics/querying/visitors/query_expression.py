from collections.abc import Sequence

from snuba_sdk import AliasedExpression, Column, Condition, Formula, Op, Timeseries
from snuba_sdk.conditions import ConditionGroup

from sentry.models.environment import Environment
from sentry.sentry_metrics.querying.errors import (
    InvalidMetricsQueryError,
    NonNormalizableUnitsError,
)
from sentry.sentry_metrics.querying.types import QueryExpression
from sentry.sentry_metrics.querying.units import (
    MeasurementUnit,
    UnitFamily,
    get_unit_family_and_unit,
)
from sentry.sentry_metrics.querying.visitors.base import (
    QueryConditionVisitor,
    QueryExpressionVisitor,
)
from sentry.snuba.metrics import parse_mri


class EnvironmentsInjectionVisitor(QueryExpressionVisitor[QueryExpression]):
    """
    Visitor that recursively injects the environments filter into all `Timeseries`.
    """

    def __init__(self, environments: Sequence[Environment]):
        self._environment_names = [environment.name for environment in environments]

    def _visit_timeseries(self, timeseries: Timeseries) -> QueryExpression:
        if self._environment_names:
            current_filters = timeseries.filters if timeseries.filters else []
            current_filters.extend(
                [Condition(Column("environment"), Op.IN, self._environment_names)]
            )

            return timeseries.set_filters(current_filters)

        return timeseries


class TimeseriesConditionInjectionVisitor(QueryExpressionVisitor[QueryExpression]):
    """
    Visitor that recursively injects a `ConditionGroup` into all `Timeseries`.
    """

    def __init__(self, condition_group: ConditionGroup):
        self._condition_group = condition_group

    def _visit_timeseries(self, timeseries: Timeseries) -> QueryExpression:
        if self._condition_group:
            current_filters = timeseries.filters if timeseries.filters else []
            current_filters.extend(self._condition_group)

            return timeseries.set_filters(current_filters)

        return timeseries


class QueryValidationVisitor(QueryExpressionVisitor[QueryExpression]):
    """
    Visitor that recursively validates the `QueryExpression`.
    """

    def _visit_timeseries(self, timeseries: Timeseries) -> QueryExpression:
        # This visitor has been kept in case we need future validations.
        return timeseries


class QueryValidationV2Visitor(QueryExpressionVisitor[QueryExpression]):
    """
    Visitor that recursively validates the `QueryExpression` of the new endpoint.
    """

    def __init__(self):
        self._query_namespace = None
        self._query_entity = None
        self._query_group_bys = None
        self._query_group_bys_stack: list[list[str]] = []

    def _visit_formula(self, formula: Formula) -> QueryExpression:
        # We already add the flattened group bys in the stack, to avoid re-computation for every leaf.
        self._query_group_bys_stack.append(self._flatten_group_bys(formula.groupby))

        for parameter in formula.parameters:
            self.visit(parameter)

        self._query_group_bys_stack.pop()

        return formula

    def _visit_timeseries(self, timeseries: Timeseries) -> QueryExpression:
        if timeseries.metric.mri is None:
            raise InvalidMetricsQueryError("You must supply a metric MRI when querying a metric")

        parsed_mri = parse_mri(timeseries.metric.mri)
        if parsed_mri is None:
            raise InvalidMetricsQueryError(
                f"The metric MRI {timeseries.metric.mri} couldn't be parsed"
            )

        namespace = parsed_mri.namespace
        entity = parsed_mri.entity

        if self._query_namespace is None:
            self._query_namespace = namespace
        elif self._query_namespace != namespace:
            raise InvalidMetricsQueryError(
                "Querying metrics belonging to different namespaces is not allowed"
            )

        if self._query_entity is None:
            self._query_entity = parsed_mri.entity
        elif self._query_entity != entity:
            raise InvalidMetricsQueryError(
                "Querying metrics with different metrics type is not currently supported"
            )

        self._validate_accumulated_group_bys(timeseries)

        return timeseries

    def _validate_accumulated_group_bys(self, timeseries: Timeseries):
        """
        Validates that the group bys on a given `Timeseries` are equal to the ones previously encountered (if any).

        To obtain the group bys of the `Timeseries` all the group bys of the upstream `Formulas` are merged and ordered
        together with the ones of the `Timeseries`.
        """
        group_bys = []

        # We first add all the group bys that we got at each stack frame.
        for upstream_group_bys in self._query_group_bys_stack:
            group_bys += upstream_group_bys

        # We then add all the group bys of the timeseries itself.
        group_bys += self._flatten_group_bys(timeseries.groupby)

        # We deduplicate and sort all the merged group bys in order to have a consistent view of the used group bys.
        sorted_group_bys = sorted(set(group_bys))
        if self._query_group_bys is None:
            self._query_group_bys = sorted_group_bys
        elif self._query_group_bys != sorted_group_bys:
            raise InvalidMetricsQueryError(
                "Querying metrics with different group bys is not allowed"
            )

    def _flatten_group_bys(self, group_bys: list[Column | AliasedExpression] | None) -> list[str]:
        """
        Flattens a list of group bys by converting it to a flat list of strings, representing the names of the column
        that the query is grouping by.
        """

        def _column_name(group_by: Column | AliasedExpression) -> str:
            if isinstance(group_by, Column):
                return group_by.name
            elif isinstance(group_by, AliasedExpression):
                return group_by.exp.name

            return ""

        if group_bys is None:
            return []

        return list(map(_column_name, group_bys))


class QueryConditionsCompositeVisitor(QueryExpressionVisitor[QueryExpression]):
    """
    Visitor that runs a series of `QueryConditionVisitor`(s) on each filters of elements of a `QueryExpression`.
    """

    def __init__(self, *visitors: QueryConditionVisitor):
        self._visitors = list(visitors)

    def _visit_formula(self, formula: Formula) -> QueryExpression:
        if formula.filters:
            formula = formula.set_filters(self._apply_visitors_on_condition_group(formula.filters))

        return super()._visit_formula(formula)

    def _visit_timeseries(self, timeseries: Timeseries) -> QueryExpression:
        if not timeseries.filters:
            return timeseries

        return timeseries.set_filters(self._apply_visitors_on_condition_group(timeseries.filters))

    def _apply_visitors_on_condition_group(
        self, condition_group: ConditionGroup | None
    ) -> ConditionGroup | None:
        if not condition_group:
            return condition_group

        visited_condition_group = condition_group
        for visitor in self._visitors:
            visited_condition_group = visitor.visit_group(visited_condition_group)

        return visited_condition_group


class QueriedMetricsVisitor(QueryExpressionVisitor[set[str]]):
    """
    Visitor that recursively computes all the metrics MRI of the `QueryExpression`.
    """

    def _visit_formula(self, formula: Formula) -> set[str]:
        metrics: set[str] = set()

        for parameter in formula.parameters:
            metrics = metrics.union(self.visit(parameter))

        return metrics

    def _visit_timeseries(self, timeseries: Timeseries) -> set[str]:
        if timeseries.metric.mri is None:
            raise InvalidMetricsQueryError("Can't determine queried metrics without a MRI")

        return {timeseries.metric.mri}

    def _visit_int(self, int_number: float):
        return set()

    def _visit_float(self, float_number: float) -> set[str]:
        return set()

    def _visit_string(self, string: str) -> set[str]:
        return set()


class UsedGroupBysVisitor(QueryExpressionVisitor[set[str]]):
    """
    Visitor that recursively computes all the groups of the `QueryExpression`.
    """

    def _visit_formula(self, formula: Formula) -> set[str]:
        group_bys: set[str] = set()

        for parameter in formula.parameters:
            group_bys = group_bys.union(self.visit(parameter))

        return group_bys.union(self._group_bys_as_string(formula.groupby))

    def _visit_timeseries(self, timeseries: Timeseries) -> set[str]:
        return self._group_bys_as_string(timeseries.groupby)

    def _visit_int(self, int_number: float):
        return set()

    def _visit_float(self, float_number: float) -> set[str]:
        return set()

    def _visit_string(self, string: str) -> set[str]:
        return set()

    def _group_bys_as_string(self, group_bys: list[Column | AliasedExpression] | None) -> set[str]:
        if not group_bys:
            return set()

        string_group_bys = set()
        for group_by in group_bys:
            if isinstance(group_by, AliasedExpression):
                string_group_bys.add(group_by.exp.name)
            elif isinstance(group_by, Column):
                string_group_bys.add(group_by.name)

        return string_group_bys


class UnitsNormalizationVisitor(QueryExpressionVisitor[QueryExpression]):
    """
    Visitor that recursively transforms the `QueryExpression` components to have the same unit. Throws an error in
    case units are incompatible.
    """

    UNITLESS_AGGREGATES = {"count", "count_unique"}

    def __init__(self):
        self._unit_family = None
        self._reference_unit = None
        self._scaling_factor = None

        self._is_formula = False

    def _visit_formula(self, formula: Formula) -> QueryExpression:
        self._is_formula = True
        return super()._visit_formula(formula)

    def _visit_timeseries(self, timeseries: Timeseries) -> QueryExpression:
        extracted_unit = self._extract_unit(timeseries=timeseries)
        if extracted_unit is not None:
            unit_family, reference_unit, unit = get_unit_family_and_unit(extracted_unit)
            # If we encounter multiple unit families in a `QueryExpression`, we want to unwind and not apply any
            # units normalization.
            if self._unit_family is not None and unit_family != self._unit_family:
                raise NonNormalizableUnitsError("Multiple unit families are found in the formula")

            # We set the first seen unit family, irrespectively if a unit is found, since if it's not found, the family
            # will be unknown.
            self._unit_family = unit_family

            if reference_unit is not None and unit is not None:
                self._reference_unit = reference_unit
                self._scaling_factor = unit.scaling_factor
                return unit.apply_on_timeseries(timeseries)

        return timeseries

    def _extract_unit(self, timeseries: Timeseries) -> str | None:
        # If the aggregate doesn't support unit normalization, we will skip it.
        if timeseries.aggregate in self.UNITLESS_AGGREGATES:
            raise NonNormalizableUnitsError(
                f"The aggregate {timeseries.aggregate} doesn't need unit normalization"
            )

        parsed_mri = parse_mri(timeseries.metric.mri)
        if parsed_mri is not None:
            return parsed_mri.unit

        raise NonNormalizableUnitsError(
            "Units normalization can't be run if not all components have a metric mri"
        )

    def get_units_metadata(
        self,
    ) -> tuple[UnitFamily | None, MeasurementUnit | None, float | int | None]:
        """
        Returns metadata of the units that were encountered during the traversal.
        """
        # If we have a formula, we do not return the scaling factor, since a formula technically has multiple scaling
        # factors, but they won't be of use to the frontend.
        if self._is_formula:
            return self._unit_family, self._reference_unit, None

        return self._unit_family, self._reference_unit, self._scaling_factor
