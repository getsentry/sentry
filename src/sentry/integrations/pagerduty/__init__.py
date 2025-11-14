from typing import int
from sentry.rules import rules

from .actions import PagerDutyNotifyServiceAction
from .analytics import *  # noqa: F401,F403
from .handlers import PagerdutyActionHandler  # noqa: F401,F403

rules.add(PagerDutyNotifyServiceAction)
