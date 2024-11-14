class ReleaseThresholdType:
    TOTAL_ERROR_COUNT = 0
    NEW_ISSUE_COUNT = 1
    UNHANDLED_ISSUE_COUNT = 2
    REGRESSED_ISSUE_COUNT = 3
    FAILURE_RATE = 4
    CRASH_FREE_SESSION_RATE = 5
    CRASH_FREE_USER_RATE = 6

    TOTAL_ERROR_COUNT_STR = "total_error_count"
    NEW_ISSUE_COUNT_STR = "new_issue_count"
    UNHANDLED_ISSUE_COUNT_STR = "unhandled_issue_count"
    REGRESSED_ISSUE_COUNT_STR = "regressed_issue_count"
    FAILURE_RATE_STR = "failure_rate"
    CRASH_FREE_SESSION_RATE_STR = "crash_free_session_rate"
    CRASH_FREE_USER_RATE_STR = "crash_free_user_rate"

    @classmethod
    def as_choices(cls):
        return (
            (cls.TOTAL_ERROR_COUNT_STR, cls.TOTAL_ERROR_COUNT),
            (cls.NEW_ISSUE_COUNT_STR, cls.NEW_ISSUE_COUNT),
            (cls.UNHANDLED_ISSUE_COUNT_STR, cls.UNHANDLED_ISSUE_COUNT),
            (cls.REGRESSED_ISSUE_COUNT_STR, cls.REGRESSED_ISSUE_COUNT),
            (cls.FAILURE_RATE_STR, cls.FAILURE_RATE),
            (cls.CRASH_FREE_SESSION_RATE_STR, cls.CRASH_FREE_SESSION_RATE),
            (cls.CRASH_FREE_USER_RATE_STR, cls.CRASH_FREE_USER_RATE),
        )

    @classmethod
    def as_str_choices(cls):
        return (
            (cls.TOTAL_ERROR_COUNT_STR, cls.TOTAL_ERROR_COUNT_STR),
            (cls.NEW_ISSUE_COUNT_STR, cls.NEW_ISSUE_COUNT_STR),
            (cls.UNHANDLED_ISSUE_COUNT_STR, cls.UNHANDLED_ISSUE_COUNT_STR),
            (cls.REGRESSED_ISSUE_COUNT_STR, cls.REGRESSED_ISSUE_COUNT_STR),
            (cls.FAILURE_RATE_STR, cls.FAILURE_RATE_STR),
            (cls.CRASH_FREE_SESSION_RATE_STR, cls.CRASH_FREE_SESSION_RATE_STR),
            (cls.CRASH_FREE_USER_RATE_STR, cls.CRASH_FREE_USER_RATE_STR),
        )


class TriggerType:
    OVER = 0
    UNDER = 1

    OVER_STR = "over"
    UNDER_STR = "under"

    @classmethod
    def as_choices(cls):  # choices for model column
        return (
            (cls.OVER_STR, cls.OVER),
            (cls.UNDER_STR, cls.UNDER),
        )

    @classmethod
    def as_str_choices(cls):  # choices for serializer
        return (
            (cls.OVER_STR, cls.OVER_STR),
            (cls.UNDER_STR, cls.UNDER_STR),
        )


THRESHOLD_TYPE_INT_TO_STR = {
    ReleaseThresholdType.TOTAL_ERROR_COUNT: ReleaseThresholdType.TOTAL_ERROR_COUNT_STR,
    ReleaseThresholdType.NEW_ISSUE_COUNT: ReleaseThresholdType.NEW_ISSUE_COUNT_STR,
    ReleaseThresholdType.UNHANDLED_ISSUE_COUNT: ReleaseThresholdType.UNHANDLED_ISSUE_COUNT_STR,
    ReleaseThresholdType.REGRESSED_ISSUE_COUNT: ReleaseThresholdType.REGRESSED_ISSUE_COUNT_STR,
    ReleaseThresholdType.FAILURE_RATE: ReleaseThresholdType.FAILURE_RATE_STR,
    ReleaseThresholdType.CRASH_FREE_SESSION_RATE: ReleaseThresholdType.CRASH_FREE_SESSION_RATE_STR,
    ReleaseThresholdType.CRASH_FREE_USER_RATE: ReleaseThresholdType.CRASH_FREE_USER_RATE_STR,
}

THRESHOLD_TYPE_STR_TO_INT = {
    ReleaseThresholdType.TOTAL_ERROR_COUNT_STR: ReleaseThresholdType.TOTAL_ERROR_COUNT,
    ReleaseThresholdType.NEW_ISSUE_COUNT_STR: ReleaseThresholdType.NEW_ISSUE_COUNT,
    ReleaseThresholdType.UNHANDLED_ISSUE_COUNT_STR: ReleaseThresholdType.UNHANDLED_ISSUE_COUNT,
    ReleaseThresholdType.REGRESSED_ISSUE_COUNT_STR: ReleaseThresholdType.REGRESSED_ISSUE_COUNT,
    ReleaseThresholdType.FAILURE_RATE_STR: ReleaseThresholdType.FAILURE_RATE,
    ReleaseThresholdType.CRASH_FREE_SESSION_RATE_STR: ReleaseThresholdType.CRASH_FREE_SESSION_RATE,
    ReleaseThresholdType.CRASH_FREE_USER_RATE_STR: ReleaseThresholdType.CRASH_FREE_USER_RATE,
}

TRIGGER_TYPE_INT_TO_STR = {
    TriggerType.OVER: TriggerType.OVER_STR,
    TriggerType.UNDER: TriggerType.UNDER_STR,
}

TRIGGER_TYPE_STRING_TO_INT = {
    TriggerType.OVER_STR: TriggerType.OVER,
    TriggerType.UNDER_STR: TriggerType.UNDER,
}
