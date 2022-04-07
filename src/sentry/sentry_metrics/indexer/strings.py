# DO NOT CHANGE THESE VALUES
SHARED_METRIC_NAMES = {
    "c:sessions/session@none": 1,
    "s:sessions/error@none": 2,
    "s:sessions/user@none": 3,
    "d:sessions/duration@second": 4,
}
SHARED_TAG_STRINGS = {
    "abnormal": 5,
    "crashed": 6,
    "environment": 7,
    "errored": 8,
    "exited": 9,
    "healthy": 10,
    "init": 11,
    "production": 12,
    "release": 13,
    "session.status": 14,
    "staging": 15,
}
SHARED_STRINGS = {**SHARED_METRIC_NAMES, **SHARED_TAG_STRINGS}
REVERSE_SHARED_STRINGS = {v: k for k, v in SHARED_STRINGS.items()}
