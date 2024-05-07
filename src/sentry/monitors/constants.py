from enum import Enum

# default maximum runtime for a monitor, in minutes
TIMEOUT = 30

# hard maximum runtime for a monitor, in minutes
# current limit is 28 days
MAX_TIMEOUT = 40_320

# Format to use in the issue subtitle for the missed check-in timestamp
SUBTITLE_DATETIME_FORMAT = "%b %d, %I:%M %p %Z"

# maximum value for incident + recovery thresholds to be set
# affects the performance of recent check-ins query
# lowering this may invalidate monitors + block check-ins
MAX_THRESHOLD = 720

# minimum value in minutes for monitor to not receive a check-in before
# being marked as missed
DEFAULT_CHECKIN_MARGIN = 1

# Enforced maximum length of the monitor slug
MAX_SLUG_LENGTH = 50


class PermitCheckInStatus(Enum):
    ACCEPT = 0
    """
    Check-in should be fully accepted and shall be passed through
    the entire Monitor Check-In processing logic.
    """

    DROP = 1
    """
    Check-in should not be processed. All logic should be skipped
    and the consumer should halt work on this check-in immediately.
    """

    ACCEPTED_FOR_UPSERT = 2
    """
    The check-in should be accepted to allow a monitor to be auto-created
    if possible. However the check-in should be discarded once the monitor
    has been upserted.

    This status is used when an unknown monitor slug is seen and has yet to
    have been assigned a seat.
    """
