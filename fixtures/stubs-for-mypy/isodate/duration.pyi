import datetime
import decimal
from typing import overload

class Duration:
    months: decimal.Decimal
    years: decimal.Decimal
    tdelta: datetime.timedelta

    def __init__(
            self,
            days: int,
            seconds: int,
            microseconds: int,
            milliseconds: int,
            minutes: int,
            hours: int,
            weeks: int,
            months: int | decimal.Decimal,
            years: int | decimal.Decimal,
    ) -> None:
        ...

    @overload
    def __add__(self, other: datetime.datetime) -> datetime.datetime: ...
    @overload
    def __add__(self, other: datetime.timedelta) -> Duration: ...
    @overload
    def __add__(self, other: Duration) -> Duration: ...

    __radd__ = __add__
