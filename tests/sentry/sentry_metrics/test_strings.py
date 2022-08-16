from sentry.sentry_metrics.configuration import UseCaseKey
from sentry.sentry_metrics.indexer.mock import MockIndexer
from sentry.sentry_metrics.indexer.strings import SHARED_STRINGS, StaticStringIndexer

use_case_id = UseCaseKey("release-health")


def test_static_strings_only() -> None:
    indexer = StaticStringIndexer(MockIndexer())
    org_strings = {2: {"release"}, 3: {"production", "environment", "release"}}
    results = indexer.bulk_record(use_case_id=use_case_id, org_strings=org_strings)

    assert results[2]["release"] == SHARED_STRINGS["release"]
    assert results[3]["production"] == SHARED_STRINGS["production"]
    assert results[3]["environment"] == SHARED_STRINGS["environment"]
    assert results[3]["release"] == SHARED_STRINGS["release"]
