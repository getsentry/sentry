from collections.abc import Sequence
from dataclasses import dataclass
from enum import Enum
from typing import Literal, Union

from snuba_sdk import ArithmeticOperator, Formula, Timeseries

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
    name: MeasurementUnit
    scaling_factor: float

    def convert(self, value: float | int) -> float:
        return value * (self.scaling_factor or 1)

    def apply_on_timeseries(self, timeseries: Timeseries) -> Formula:
        return Formula(
            function_name=ArithmeticOperator.MULTIPLY.value,
            parameters=[timeseries, self.scaling_factor],
        )

    def __hash__(self):
        return hash(self.name)


@dataclass(frozen=True)
class Units:
    reference_unit: MeasurementUnit
    units: Sequence[Unit]


FAMILY_TO_UNITS = {
    UnitFamily.DURATION: Units(
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
    )
}


def get_unit_family_and_unit(unit: MeasurementUnit) -> tuple[UnitFamily, Unit] | None:
    for unit_family, units in FAMILY_TO_UNITS.items():
        for inner_unit in units.units:
            if inner_unit.name == unit:
                return unit_family, inner_unit

    return None
