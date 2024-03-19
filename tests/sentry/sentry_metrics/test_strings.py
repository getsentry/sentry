import pytest
from django.test import override_settings

from sentry.sentry_metrics.indexer.mock import MockIndexer
from sentry.sentry_metrics.indexer.strings import PREFIX, SHARED_STRINGS, StaticStringIndexer
from sentry.sentry_metrics.use_case_id_registry import UseCaseID
from sentry.snuba.metrics.naming_layer.mri import parse_mri

use_case_id = UseCaseID.SESSIONS


def test_static_strings_only() -> None:
    indexer = StaticStringIndexer(MockIndexer())
    org_strings = {2: {"release"}, 3: {"production", "environment", "release"}}
    results = indexer.bulk_record({use_case_id: org_strings})

    assert results[use_case_id][2]["release"] == SHARED_STRINGS["release"]
    assert results[use_case_id][3]["production"] == SHARED_STRINGS["production"]
    assert results[use_case_id][3]["environment"] == SHARED_STRINGS["environment"]
    assert results[use_case_id][3]["release"] == SHARED_STRINGS["release"]


def test_resolve_shared_org_existing_entry() -> None:
    """
    Tests it is able to resolve shared strings
    """
    indexer = StaticStringIndexer(MockIndexer())

    actual = indexer.resolve_shared_org("release")
    expected = SHARED_STRINGS["release"]

    assert actual == expected


def test_reverse_resolve_shared_org_existing_entry() -> None:
    """
    Tests it is able to return correct strings for known
    shared string ids
    """
    indexer = StaticStringIndexer(MockIndexer())

    release_idx = indexer.resolve_shared_org("release")
    assert release_idx is not None
    actual = indexer.reverse_shared_org_resolve(release_idx)

    assert actual == "release"


def test_resolve_shared_org_no_entry() -> None:
    """
    Tests that it returns None for unknown strings
    """
    indexer = StaticStringIndexer(MockIndexer())
    actual = indexer.resolve_shared_org("SOME_MADE_UP_STRING")
    assert actual is None


def test_reverse_resolve_shared_org_no_entry() -> None:
    indexer = StaticStringIndexer(MockIndexer())
    # shared string start quite high 2^63 so anything smaller should return None
    actual = indexer.reverse_shared_org_resolve(5)
    assert actual is None


REINDEXED_INTS = {12345678: "release"}


@override_settings(SENTRY_METRICS_INDEXER_REINDEXED_INTS=REINDEXED_INTS)
def test_reverse_resolve_reindexed():
    """
    If we have deleted a record accidentally and whose id still lives in
    ClickHouse, then we need to account for the re-indexed id. Since the
    indexer table has a unique contraint on the org and string, we have a
    hardcoded setting that let's us patch reverse_resolve so that we don't
    get MetricIndexNotFound and return a 500.
    """
    indexer = StaticStringIndexer(MockIndexer())
    id = indexer.record(use_case_id, 2, "release")
    # for mypy
    assert id

    assert indexer.reverse_resolve(UseCaseID.SESSIONS, 1, id) == "release"
    assert indexer.reverse_resolve(UseCaseID.SESSIONS, 1, 12345678) == "release"


@pytest.mark.parametrize(
    ["mri", "id"],
    [
        pytest.param(
            string,
            id,
            marks=pytest.mark.skipif(
                string
                in {
                    "s:transactions/span.user@none",
                    "d:transactions/span.duration@millisecond",
                    "d:transactions/span.exclusive_time@millisecond",
                },
                reason="deprecated MRI",
            ),
            id=string,
        )
        for string, id in SHARED_STRINGS.items()
        if parse_mri(string) is not None
    ],
)
def test_shared_mri_string_range(mri, id):
    parsed_mri = parse_mri(mri)
    assert parsed_mri is not None, mri
    try:
        start, end = {
            "sessions": (1, 99),
            "transactions": (100, 199),
            "spans": (400, 499),
            "escalating_issues": (500, 599),
            "profiles": (600, 699),
            "bundle_analysis": (700, 799),
            "metric_stats": (800, 899),
        }[parsed_mri.namespace]
    except KeyError:
        raise Exception(f"Unknown namespace: {parsed_mri.namespace}")

    start += PREFIX
    end += PREFIX

    assert (
        start <= id <= end
    ), f"id for MRI: {mri} fall outside of expected range. Expected {start} - {end}, got {id}"
