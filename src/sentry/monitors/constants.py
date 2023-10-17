# default maximum runtime for a monitor, in minutes
TIMEOUT = 30

# hard maximum runtime for a monitor, in minutes
# current limit is 28 days
MAX_TIMEOUT = 40_320

# Format to use in the issue subtitle for the missed check-in timestamp
SUBTITLE_DATETIME_FORMAT = "%b %d, %I:%M %p"

# maximum value for incident + recovery thresholds to be set
# affects the performance of recent check-ins query
# lowering this may invalidate monitors + block check-ins
MAX_THRESHOLD = 720
