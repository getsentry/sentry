""" Base module for sessions-related metrics """
from enum import Enum


class SessionMetricKey(Enum):
    """Identifier for a session-related metric

    Values are metric names as submitted by Relay.
    """

    SESSION = "sentry.sessions.session"
    SESSION_DURATION = "sentry.sessions.session.duration"
    SESSION_ERROR = "sentry.sessions.session.error"
    USER = "sentry.sessions.user"
