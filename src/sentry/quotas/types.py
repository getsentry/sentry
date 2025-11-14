from typing import TypeAlias, Union, int

from sentry.monitors.models import Monitor
from sentry.workflow_engine.models import Detector

SeatObject: TypeAlias = Union[Monitor, Detector]
