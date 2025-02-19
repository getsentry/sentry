from enum import IntEnum


class IncidentStatus(IntEnum):
    """
    Used to identify what the current status of a uptime monitor is.
    """

    NO_INCIDENT = 0
    IN_INCIDENT = 1
