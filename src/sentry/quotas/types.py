from typing import TypeAlias, Union

from sentry.monitors.models import Monitor
from sentry.uptime.models import ProjectUptimeSubscription
from sentry.workflow_engine.models import Detector

SeatObject: TypeAlias = Union[Monitor, ProjectUptimeSubscription, Detector]
