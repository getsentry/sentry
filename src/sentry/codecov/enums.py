from enum import Enum


class OrderingDirection(Enum):
    DESC = "DESC"
    ASC = "ASC"


class OrderingParameter(Enum):
    AVG_DURATION = "AVG_DURATION"
    FLAKE_RATE = "FLAKE_RATE"
    FAILURE_RATE = "FAILURE_RATE"
    COMMITS_WHERE_FAIL = "COMMITS_WHERE_FAIL"
    UPDATED_AT = "UPDATED_AT"


class TestResultsFilterParameter(Enum):
    FLAKY_TESTS = "FLAKY_TESTS"
    FAILED_TESTS = "FAILED_TESTS"
    SLOWEST_TESTS = "SLOWEST_TESTS"
    SKIPPED_TESTS = "SKIPPED_TESTS"


class MeasurementInterval(Enum):
    INTERVAL_30_DAY = "INTERVAL_30_DAY"
    INTERVAL_7_DAY = "INTERVAL_7_DAY"
    INTERVAL_1_DAY = "INTERVAL_1_DAY"
