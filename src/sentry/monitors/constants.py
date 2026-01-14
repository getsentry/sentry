from enum import Enum

# default maximum runtime for a monitor, in minutes
TIMEOUT = 30

# hard maximum runtime for a monitor, in minutes
# current limit is 28 days
MAX_TIMEOUT = 40_320

# hard maximum miss margin for a monitor, in minutes
# current limit is 28 days
MAX_MARGIN = 40_320

# maximum value for incident + recovery thresholds to be set
# affects the performance of recent check-ins query
# lowering this may invalidate monitors + block check-ins
MAX_THRESHOLD = 720

# minimum value for failure issue + recovery thresholds
MIN_THRESHOLD = 1

# minimum value in minutes for monitor to not receive a check-in before
# being marked as missed
DEFAULT_CHECKIN_MARGIN = 1

# minimum number of padding ticks to be generated for a sample window
SAMPLE_PADDING_TICKS_MIN_COUNT = 2

# ratio of padding ticks to be generated for a sample window, relative to the total thresholds
SAMPLE_PADDING_RATIO_OF_THRESHOLD = 1  

# ratio of issue open period ticks to be generated for a sample window, relative to the total thresholds
SAMPLE_OPEN_PERIOD_RATIO = 2


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
