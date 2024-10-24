from collections.abc import Collection, Mapping

from django.conf import settings

from sentry.sentry_metrics.indexer.base import (
    FetchType,
    OrgId,
    StringIndexer,
    UseCaseKeyCollection,
    UseCaseKeyResult,
    UseCaseKeyResults,
    metric_path_key_compatible_resolve,
    metric_path_key_compatible_rev_resolve,
)
from sentry.sentry_metrics.use_case_id_registry import UseCaseID
from sentry.utils import metrics

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
    "c:transactions/count_per_root_project@none": PREFIX + 125,
    "d:transactions/measurements.time_to_initial_display@millisecond": PREFIX + 126,
    "d:transactions/measurements.time_to_full_display@millisecond": PREFIX + 127,
    "c:transactions/on_demand@none": PREFIX + 128,
    "d:transactions/on_demand@none": PREFIX + 129,
    "s:transactions/on_demand@none": PREFIX + 130,
    "g:transactions/on_demand@none": PREFIX + 131,
    "c:transactions/alert@none": PREFIX + 132,
    "d:transactions/alert@none": PREFIX + 133,
    "s:transactions/alert@none": PREFIX + 134,
    "g:transactions/alert@none": PREFIX + 135,
    "d:transactions/duration_light@millisecond": PREFIX + 136,
    "c:transactions/usage@none": PREFIX + 137,
    "d:transactions/measurements.score.cls@ratio": PREFIX + 138,
    "d:transactions/measurements.score.fcp@ratio": PREFIX + 139,
    "d:transactions/measurements.score.fid@ratio": PREFIX + 140,
    "d:transactions/measurements.score.lcp@ratio": PREFIX + 141,
    "d:transactions/measurements.score.ttfb@ratio": PREFIX + 142,
    "d:transactions/measurements.score.total@ratio": PREFIX + 143,
    "d:transactions/measurements.score.weight.cls@ratio": PREFIX + 144,
    "d:transactions/measurements.score.weight.fcp@ratio": PREFIX + 145,
    "d:transactions/measurements.score.weight.fid@ratio": PREFIX + 146,
    "d:transactions/measurements.score.weight.lcp@ratio": PREFIX + 147,
    "d:transactions/measurements.score.weight.ttfb@ratio": PREFIX + 148,
    # Last possible index: 199
}

# 200 - 399
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
    # Transactions
    "drop": PREFIX + 239,
    "decision": PREFIX + 240,
    "keep": PREFIX + 241,
    # Spans
    "span.op": PREFIX + 242,
    "span.module": PREFIX + 243,
    "span.action": PREFIX + 244,
    "span.system": PREFIX + 245,
    "span.status": PREFIX + 246,
    "span.status_code": PREFIX + 247,
    "span.domain": PREFIX + 248,
    "span.description": PREFIX + 249,
    "http.status_code": PREFIX + 250,
    "geo.country_code": PREFIX + 251,
    "span.group": PREFIX + 252,
    "transaction.method": PREFIX + 253,
    "span.category": PREFIX + 254,
    "span.main_thread": PREFIX + 255,
    "device.class": PREFIX + 256,
    "resource.render_blocking_status": PREFIX + 257,
    "ttid": PREFIX + 258,
    "ttfd": PREFIX + 259,
    # More Transactions
    "has_profile": PREFIX + 260,
    "query_hash": PREFIX + 261,
    "failure": PREFIX + 262,
    # Escalating Issues
    "group": PREFIX + 263,
    # Resource span
    "file_extension": PREFIX + 264,
    "app_start_type": PREFIX + 265,  # Mobile app start type
    # Profiles
    "function": PREFIX + 266,  # Function name
    "package": PREFIX
    + 267,  # it could be either a package or a module, but in profiling we don't make a distinction
    "fingerprint": PREFIX + 268,  # takes into account function name and package
    "is_application": PREFIX + 269,
    "platform": PREFIX + 270,
    "os.version": PREFIX + 271,
    # Performance Score
    "sentry.score_profile_version": PREFIX + 272,
    # Metric stats
    "mri": PREFIX + 273,
    "mri.type": PREFIX + 274,
    "mri.namespace": PREFIX + 275,
    "outcome.id": PREFIX + 276,
    "outcome.reason": PREFIX + 277,
    "cardinality.window": PREFIX + 278,
    "cardinality.limit": PREFIX + 279,
    "cardinality.scope": PREFIX + 280,
    # GENERAL/MISC (don't have a category)
    "": PREFIX + 1000,
}

# 400-499
SPAN_METRICS_NAMES = {
    # Deprecated -- transactions namespace
    "s:transactions/span.user@none": PREFIX + 400,
    "d:transactions/span.duration@millisecond": PREFIX + 401,
    "d:transactions/span.exclusive_time@millisecond": PREFIX + 402,
    # Spans namespace
    "s:spans/user@none": PREFIX + 403,
    "d:spans/duration@millisecond": PREFIX + 404,
    "d:spans/exclusive_time@millisecond": PREFIX + 405,
    "d:spans/exclusive_time_light@millisecond": PREFIX + 406,
    "d:spans/frames_frozen@none": PREFIX + 407,
    "d:spans/frames_slow@none": PREFIX + 408,
    "d:spans/http.response_content_length@byte": PREFIX + 409,
    "d:spans/http.decoded_response_content_length@byte": PREFIX + 410,
    "d:spans/http.response_transfer_size@byte": PREFIX + 411,
    "c:spans/count_per_op@none": PREFIX + 412,
    "c:spans/count_per_segment@none": PREFIX + 413,
    "d:spans/webvital.score.total@ratio": PREFIX + 414,
    "d:spans/webvital.score.inp@ratio": PREFIX + 415,
    "d:spans/webvital.score.weight.inp@ratio": PREFIX + 416,
    "d:spans/webvital.inp@millisecond": PREFIX + 417,
    "c:spans/usage@none": PREFIX + 418,
    "g:spans/self_time@millisecond": PREFIX + 419,
    "g:spans/self_time_light@millisecond": PREFIX + 420,
    "g:spans/total_time@millisecond": PREFIX + 421,
    "c:spans/count_per_root_project@none": PREFIX + 422,
    # Last possible index: 499
}

# 500-599
ESCALATING_ISSUES_METRIC_NAMES = {
    "c:escalating_issues/event_ingested@none": PREFIX + 500,
}

# 600-699
PROFILING_METRIC_NAMES = {
    "d:profiles/function.duration@millisecond": PREFIX + 600,
}

# 700-799
BUNDLE_ANALYSIS_METRIC_NAMES = {
    "d:bundle_analysis/bundle_size@byte": PREFIX + 700,
}

# 800-899
METRIC_STATS_METRIC_NAMES = {
    "c:metric_stats/volume@none": PREFIX + 800,
    "g:metric_stats/cardinality@none": PREFIX + 801,
}


SHARED_STRINGS = {
    **SESSION_METRIC_NAMES,
    **TRANSACTION_METRICS_NAMES,
    **SPAN_METRICS_NAMES,
    **ESCALATING_ISSUES_METRIC_NAMES,
    **PROFILING_METRIC_NAMES,
    **BUNDLE_ANALYSIS_METRIC_NAMES,
    **METRIC_STATS_METRIC_NAMES,
    **SHARED_TAG_STRINGS,
}
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
        self, strings: Mapping[UseCaseID, Mapping[OrgId, set[str]]]
    ) -> UseCaseKeyResults:
        static_keys = UseCaseKeyCollection(strings)
        static_key_results = UseCaseKeyResults()
        for use_case_id, org_id, string in static_keys.as_tuples():
            if string in SHARED_STRINGS:
                id = SHARED_STRINGS[string]
                static_key_results.add_use_case_key_result(
                    UseCaseKeyResult(use_case_id, org_id, string, id), FetchType.HARDCODED
                )

        org_strings_left = static_key_results.get_unmapped_use_case_keys(static_keys)

        if org_strings_left.size == 0:
            return static_key_results

        indexer_results = self.indexer.bulk_record(
            {
                use_case_id: key_collection.mapping
                for use_case_id, key_collection in org_strings_left.mapping.items()
            }
        )

        return static_key_results.merge(indexer_results)

    def record(self, use_case_id: UseCaseID, org_id: int, string: str) -> int | None:
        if string in SHARED_STRINGS:
            return SHARED_STRINGS[string]
        return self.indexer.record(use_case_id=use_case_id, org_id=org_id, string=string)

    @metric_path_key_compatible_resolve
    def resolve(self, use_case_id: UseCaseID, org_id: int, string: str) -> int | None:
        # TODO: remove this metric after investigation is over
        if use_case_id is UseCaseID.ESCALATING_ISSUES:
            metrics.incr("sentry_metrics.indexer.string_indexer_resolve_escalating_issues")
        if string in SHARED_STRINGS:
            return SHARED_STRINGS[string]
        return self.indexer.resolve(use_case_id, org_id, string)

    @metric_path_key_compatible_rev_resolve
    def reverse_resolve(self, use_case_id: UseCaseID, org_id: int, id: int) -> str | None:
        if id in REVERSE_SHARED_STRINGS:
            return REVERSE_SHARED_STRINGS[id]

        resolved_id = self.indexer.reverse_resolve(use_case_id, org_id, id)
        if resolved_id is None:
            # HACK: if a string gets re-indexed we need to have some way to look
            # up the old id and we do it this way because the table has a unique
            # constraint on the org_id and the string.
            reindexed_ints = settings.SENTRY_METRICS_INDEXER_REINDEXED_INTS
            if id in reindexed_ints:
                return reindexed_ints[id]
        return resolved_id

    def bulk_reverse_resolve(
        self, use_case_id: UseCaseID, org_id: int, ids: Collection[int]
    ) -> Mapping[int, str]:
        shared_strings: dict[int, str] = {}
        unresolved_ids = []
        for ident in ids:
            if ident in REVERSE_SHARED_STRINGS:
                # resolved the shared string
                shared_strings[ident] = REVERSE_SHARED_STRINGS[ident]
            else:
                # remember the position of the strings we need to resolve
                unresolved_ids.append(ident)

        # insert the strings resolved by the base indexer in the global result
        org_strings = self.indexer.bulk_reverse_resolve(use_case_id, org_id, unresolved_ids)

        return {**org_strings, **shared_strings}

    def resolve_shared_org(self, string: str) -> int | None:
        if string in SHARED_STRINGS:
            return SHARED_STRINGS[string]
        return None

    def reverse_shared_org_resolve(self, id: int) -> str | None:
        if id in REVERSE_SHARED_STRINGS:
            return REVERSE_SHARED_STRINGS[id]
        return None
