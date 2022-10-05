from .analytics import *  # NOQA

# make sure to increment this when making changes to anything within the 'suspect_resolutions' directory
# keeps track of changes to how we process suspect commits, so we can filter out analytics events by the algo version
ALGO_VERSION = "0.0.5"
