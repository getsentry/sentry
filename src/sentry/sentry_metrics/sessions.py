""" Base module for sessions-related metrics """
from enum import Enum


class SessionMetricKey(Enum):
    """Identifier for a session-related metric

    Values are metric names as submitted by Relay.
    """

    DURATION = "session.duration"
    ALL = "session.all"
    ABNORMAL = "session.abnormal"
    CRASHED = "session.crashed"
    ERRORED = "session.errored"
    HEALTHY = "session.healthy"
    CRASH_FREE_RATE = "session.crash_free_rate"
    ALL_USER = "session.all_user"
    ABNORMAL_USER = "session.abnormal_user"
    CRASHED_USER = "session.crashed_user"
    ERRORED_USER = "session.errored_user"
    HEALTHY_USER = "session.healthy_user"
    CRASH_FREE_USER_RATE = "session.crash_free_user_rate"
