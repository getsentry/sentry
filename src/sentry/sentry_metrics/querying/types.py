from typing import Union

from snuba_sdk import Formula, Timeseries

QueryExpression = Union[Timeseries, Formula]
