from collections.abc import Sequence
from dataclasses import dataclass
from enum import Enum
from typing import Literal, Union

from snuba_sdk import ArithmeticOperator, Formula

from sentry.sentry_metrics.querying.types import QueryExpression

DurationUnit = Literal[
    "nanosecond",
    "microsecond",
    "millisecond",
    "second",
    "minute",
    "hour",
    "day",
    "week",
]

InformationUnit = Literal[
    "bit",
    "byte",
    "kilobyte",
    "kibibyte",
    "megabyte",
    "mebibyte",
    "gigabyte",
    "gibibyte",
    "terabyte",
    "tebibyte",
    "petabyte",
    "pebibyte",
    "exabyte",
    "exbibyte",
]

FractionUnit = Literal["ratio", "percent"]

MeasurementUnit = Union[DurationUnit, InformationUnit, FractionUnit, str]


class UnitFamily(Enum):
    """
    A family of units contains all units that are coercible between each other.
    """

    DURATION = "duration"
    INFORMATION = "information"


@dataclass(frozen=True)
class Unit:
    """
    A unit of measurement that has a scaling factor towards one reference unit.
    """

    name: MeasurementUnit
    scaling_factor: float | int

    def convert(self, value: float | int) -> float | int:
        return value * self.scaling_factor

    def apply_on_query_expression(self, query_expression: QueryExpression) -> QueryExpression:
        # In case the factor is the identity of the multiplication, we do not apply any formula.
        if self.scaling_factor in {1.0, 1}:
            return query_expression

        # In case we have just a scalar, we can multiply in-memory.
        if isinstance(query_expression, int) or isinstance(query_expression, float):
            return self.convert(query_expression)

        # We represent the scaling factor as a multiplicative factor, so that we can just multiply.
        return Formula(
            function_name=ArithmeticOperator.MULTIPLY.value,
            parameters=[query_expression, self.scaling_factor],
        )

    def __hash__(self):
        return hash(self.name)


@dataclass(frozen=True)
class UnitsSpec:
    """
    The specification of multiple units which has a common reference unit.
    """

    reference_unit: MeasurementUnit
    units: Sequence[Unit]


@dataclass(frozen=True)
class UnitMetadata:
    pass


@dataclass(frozen=True)
class WithNoUnit(UnitMetadata):
    pass


@dataclass(frozen=True)
class WithFutureUnit(UnitMetadata):
    pass


@dataclass(frozen=True)
class WithUnit(UnitMetadata):
    unit_family: UnitFamily
    reference_unit: str
    unit: Unit
    from_formula: bool = False

    @property
    def scaling_factor(self) -> int | float | None:
        if self.from_formula:
            return None

        return self.unit.scaling_factor


FAMILY_TO_UNITS = {
    UnitFamily.DURATION: UnitsSpec(
        reference_unit="nanosecond",
        units=[
            Unit("nanosecond", 1),
            Unit("microsecond", 1e3),
            Unit("millisecond", 1e6),
            Unit("second", 1e9),
            Unit("minute", 60 * 1e9),
            Unit("hour", 60 * 60 * 1e9),
            Unit("day", 24 * 60 * 60 * 1e9),
            Unit("week", 7 * 24 * 60 * 60 * 1e9),
        ],
    ),
    UnitFamily.INFORMATION: UnitsSpec(
        reference_unit="bit",
        units=[
            Unit("bit", 1),
            Unit("byte", 8),
            Unit("kilobyte", 1e3 * 8),
            Unit("kibibyte", 1024 * 8),
            Unit("megabyte", 1e3 * 1e3 * 8),
            Unit("mebibyte", 1024 * 1024 * 8),
            Unit("gigabyte", 1e3 * 1e3 * 1e3 * 8),
            Unit("gibibyte", 1024 * 1024 * 1024 * 8),
            Unit("terabyte", 1e3 * 1e3 * 1e3 * 1e3 * 8),
            Unit("tebibyte", 1024 * 1024 * 1024 * 1024 * 8),
            Unit("petabyte", 1e3 * 1e3 * 1e3 * 1e3 * 1e3 * 8),
            Unit("pebibyte", 1024 * 1024 * 1024 * 1024 * 1024 * 8),
            Unit("exabyte", 1e3 * 1e3 * 1e3 * 1e3 * 1e3 * 1e3 * 8),
            Unit("exbibyte", 1024 * 1024 * 1024 * 1024 * 1024 * 1024 * 8),
        ],
    ),
}


def get_unit_family_and_unit(
    unit: MeasurementUnit,
) -> tuple[UnitFamily, MeasurementUnit, Unit] | None:
    for unit_family, units_spec in FAMILY_TO_UNITS.items():
        for inner_unit in units_spec.units:
            if inner_unit.name == unit:
                return unit_family, units_spec.reference_unit, inner_unit

    return None


def get_reference_unit_for_unit_family(unit_family: UnitFamily) -> Unit | None:
    units_spec = FAMILY_TO_UNITS.get(unit_family)
    if units_spec is None:
        return None

    reference_unit = units_spec.reference_unit
    for unit in units_spec.units:
        if unit.name == reference_unit:
            return unit

    return None
