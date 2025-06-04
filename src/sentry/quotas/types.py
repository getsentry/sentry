from typing import TypeAlias, Union

from sentry.monitors.models import Monitor
from sentry.uptime.models import ProjectUptimeSubscription

SeatObject: TypeAlias = Union[Monitor, ProjectUptimeSubscription]
