from typing import Mapping, Optional, Set

from sentry.sentry_metrics.configuration import UseCaseKey
from sentry.sentry_metrics.indexer.base import (
    FetchType,
    KeyCollection,
    KeyResult,
    KeyResults,
    StringIndexer,
)

# !!! DO NOT CHANGE THESE VALUES !!!
#
# These are hardcoded ids for the metrics indexer and if
# they are changed they will break the product for as long
# as there are queries that use any of the strings.
#
# If there are strings that need to be added, one must make
# sure there is NOT already a record of that string.
#
# Normally, string -> id mappings are unique per organization
# but these hardcoded strings allow us to have one id across
# organizations for strings we already know are specific to the
# product.
#
# These ids are 64-bit ints. In order to hardcode the ids
# we needed to start db sequence at a higher number to make
# room so we added a db migration (0284) to alter the seq
# and reserve the first 16 bits (65536).
#
# However, since db migrations don't run in CI or dev testing
# without explicitly doing so for each test, the ids generated
# during CI and testing clobbered the ids listed here (when
# starting from 1)
#
# Instead of starting at 1 for these ids, we now add a prefix.
# The prefix allows us to start at the second half of the
# 64-bit int at `9223372036854775808`.
PREFIX = 1 << 63
# 1-99
SESSION_METRIC_NAMES = {
    "c:sessions/session@none": PREFIX + 1,
    "s:sessions/error@none": PREFIX + 2,
    "s:sessions/user@none": PREFIX + 3,
    "d:sessions/duration@second": PREFIX + 4,
}
# 100 - 199
TRANSACTION_METRICS_NAMES = {
    "s:transactions/user@none": PREFIX + 100,
    "d:transactions/duration@millisecond": PREFIX + 101,
    "d:transactions/measurements.fcp@millisecond": PREFIX + 102,
    "d:transactions/measurements.lcp@millisecond": PREFIX + 103,
    "d:transactions/measurements.app_start_cold@millisecond": PREFIX + 104,
    "d:transactions/measurements.app_start_warm@millisecond": PREFIX + 105,
    "d:transactions/measurements.cls@none": PREFIX + 106,
    "d:transactions/measurements.fid@millisecond": PREFIX + 107,
    "d:transactions/measurements.fp@millisecond": PREFIX + 108,
    "d:transactions/measurements.frames_frozen@none": PREFIX + 109,
    "d:transactions/measurements.frames_frozen_rate@ratio": PREFIX + 110,
    "d:transactions/measurements.frames_slow@none": PREFIX + 111,
    "d:transactions/measurements.frames_slow_rate@ratio": PREFIX + 112,
    "d:transactions/measurements.frames_total@none": PREFIX + 113,
    "d:transactions/measurements.stall_count@none": PREFIX + 114,
    "d:transactions/measurements.stall_longest_time@millisecond": PREFIX + 115,
    "d:transactions/measurements.stall_percentage@ratio": PREFIX + 116,
    "d:transactions/measurements.stall_total_time@millisecond": PREFIX + 117,
    "d:transactions/measurements.ttfb@millisecond": PREFIX + 118,
    "d:transactions/measurements.ttfb.requesttime@millisecond": PREFIX + 119,
    "d:transactions/breakdowns.span_ops.ops.http@millisecond": PREFIX + 120,
    "d:transactions/breakdowns.span_ops.ops.db@millisecond": PREFIX + 121,
    "d:transactions/breakdowns.span_ops.ops.browser@millisecond": PREFIX + 122,
    "d:transactions/breakdowns.span_ops.ops.resource@millisecond": PREFIX + 123,
    "d:transactions/breakdowns.span_ops.ops.ui@millisecond": PREFIX + 124,
}

# 200 - 299
SHARED_TAG_STRINGS = {
    # release health
    "abnormal": PREFIX + 200,
    "crashed": PREFIX + 201,
    "environment": PREFIX + 202,
    "errored": PREFIX + 203,
    "exited": PREFIX + 204,
    "healthy": PREFIX + 205,
    "init": PREFIX + 206,
    "production": PREFIX + 207,
    "release": PREFIX + 208,
    "session.status": PREFIX + 209,
    "staging": PREFIX + 210,
    "errored_preaggr": PREFIX + 211,
    # transactions
    "transaction": PREFIX + 212,
    "transaction.status": PREFIX + 213,
    "transaction.op": PREFIX + 214,
    "http.method": PREFIX + 215,
    "browser.name": PREFIX + 216,
    "os.name": PREFIX + 217,
    "satisfaction": PREFIX + 218,
    "ok": PREFIX + 219,  # now also used by release health
    "cancelled": PREFIX + 220,
    "unknown": PREFIX + 221,
    "aborted": PREFIX + 222,
    "satisfied": PREFIX + 223,
    "tolerated": PREFIX + 224,
    "frustrated": PREFIX + 225,
    "internal_error": PREFIX + 226,
    # outlier
    "histogram_outlier": PREFIX + 227,
    "outlier": PREFIX + 228,
    "inlier": PREFIX + 229,
    # added after the initial definition
    "sdk": PREFIX + 230,  # release health
    "<< unparameterized >>": PREFIX + 231,  # placeholder for high-cardinality transaction names
    "measurement_rating": PREFIX + 232,
    "good": PREFIX + 233,
    "bad": PREFIX + 234,
    "meh": PREFIX + 235,
    "abnormal_mechanism": PREFIX + 236,  # release health
    "anr_foreground": PREFIX + 237,  # release health
    "anr_background": PREFIX + 238,  # release health
    # GENERAL/MISC (don't have a category)
    "": PREFIX + 1000,
}
SHARED_STRINGS = {**SESSION_METRIC_NAMES, **TRANSACTION_METRICS_NAMES, **SHARED_TAG_STRINGS}
REVERSE_SHARED_STRINGS = {v: k for k, v in SHARED_STRINGS.items()}

# Make sure there are no accidental duplicates
assert len(SHARED_STRINGS) == len(REVERSE_SHARED_STRINGS)


class StaticStringIndexer(StringIndexer):
    """
    Wrapper for static strings
    """

    def __init__(self, indexer: StringIndexer) -> None:
        self.indexer = indexer

    def bulk_record(
        self, use_case_id: UseCaseKey, org_strings: Mapping[int, Set[str]]
    ) -> KeyResults:
        static_keys = KeyCollection(org_strings)
        static_key_results = KeyResults()
        for org_id, string in static_keys.as_tuples():
            if string in SHARED_STRINGS:
                id = SHARED_STRINGS[string]
                static_key_results.add_key_result(
                    KeyResult(org_id, string, id), FetchType.HARDCODED
                )

        org_strings_left = static_key_results.get_unmapped_keys(static_keys)

        if org_strings_left.size == 0:
            return static_key_results

        indexer_results = self.indexer.bulk_record(
            use_case_id=use_case_id, org_strings=org_strings_left.mapping
        )

        return static_key_results.merge(indexer_results)

    def record(self, use_case_id: UseCaseKey, org_id: int, string: str) -> Optional[int]:
        if string in SHARED_STRINGS:
            return SHARED_STRINGS[string]
        return self.indexer.record(use_case_id=use_case_id, org_id=org_id, string=string)

    def resolve(self, use_case_id: UseCaseKey, org_id: int, string: str) -> Optional[int]:
        if string in SHARED_STRINGS:
            return SHARED_STRINGS[string]
        return self.indexer.resolve(use_case_id=use_case_id, org_id=org_id, string=string)

    def reverse_resolve(self, use_case_id: UseCaseKey, org_id: int, id: int) -> Optional[str]:
        if id in REVERSE_SHARED_STRINGS:
            return REVERSE_SHARED_STRINGS[id]
        return self.indexer.reverse_resolve(use_case_id=use_case_id, org_id=org_id, id=id)
