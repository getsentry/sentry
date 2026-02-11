from datetime import datetime, timedelta, timezone

import pytest
from sentry_protos.snuba.v1.downsampled_storage_pb2 import DownsampledStorageConfig

from sentry.search.eap.types import SearchResolverConfig
from sentry.search.events.types import SnubaParams
from sentry.snuba.occurrences_rpc import Occurrences
from sentry.snuba.ourlogs import OurLogs
from sentry.snuba.rpc_dataset_common import RPCBase, TableQuery
from sentry.snuba.spans_rpc import Spans
from sentry.testutils.cases import TestCase
from sentry.testutils.factories import Factories
from sentry.testutils.pytest.fixtures import django_db_all


class TestBulkTableQueries(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.snuba_params = SnubaParams()
        self.config = SearchResolverConfig()
        self.resolver = Spans.get_resolver(self.snuba_params, self.config)

    def test_missing_name(self) -> None:
        with pytest.raises(ValueError):
            RPCBase.run_bulk_table_queries(
                [
                    TableQuery("test", ["test"], None, 0, 1, "TestReferrer", None, self.resolver),
                    TableQuery(
                        "test",
                        ["test"],
                        None,
                        0,
                        1,
                        "TestReferrer",
                        None,
                        self.resolver,
                        name="test",
                    ),
                ]
            )

    def test_duplicate_name(self) -> None:
        with pytest.raises(ValueError):
            RPCBase.run_bulk_table_queries(
                [
                    TableQuery(
                        "test",
                        ["test"],
                        None,
                        0,
                        1,
                        "TestReferrer",
                        None,
                        self.resolver,
                        name="test",
                    ),
                    TableQuery(
                        "test1",
                        ["test1"],
                        None,
                        0,
                        1,
                        "TestReferrer",
                        None,
                        self.resolver,
                        name="test",
                    ),
                ]
            )


trace_id_test_cases = (
    ["query", "mode"],
    [
        pytest.param("", DownsampledStorageConfig.MODE_NORMAL),
        pytest.param("foo:bar", DownsampledStorageConfig.MODE_NORMAL),
        pytest.param(
            "!trace:00000000000000000000000000000000", DownsampledStorageConfig.MODE_NORMAL
        ),
        pytest.param(
            "trace:00000000000000000000000000000000 foo:bar",
            DownsampledStorageConfig.MODE_HIGHEST_ACCURACY,
        ),
        pytest.param(
            "trace:00000000000000000000000000000000 AND foo:bar",
            DownsampledStorageConfig.MODE_HIGHEST_ACCURACY,
        ),
        pytest.param(
            "trace:00000000000000000000000000000000 AND trace:11111111111111111111111111111111",
            DownsampledStorageConfig.MODE_HIGHEST_ACCURACY,
        ),
        pytest.param(
            "trace:00000000000000000000000000000000 OR foo:bar",
            DownsampledStorageConfig.MODE_NORMAL,
        ),
        pytest.param(
            "trace:00000000000000000000000000000000 OR trace:11111111111111111111111111111111",
            DownsampledStorageConfig.MODE_HIGHEST_ACCURACY,
        ),
        pytest.param(
            "trace:00000000000000000000000000000000", DownsampledStorageConfig.MODE_HIGHEST_ACCURACY
        ),
    ],
)


@pytest.mark.parametrize(
    ["dataset"],
    [
        pytest.param(Spans, id="spans"),
        pytest.param(OurLogs, id="ourlogs"),
        pytest.param(Occurrences, id="occurrences"),
    ],
)
@pytest.mark.parametrize(trace_id_test_cases[0], trace_id_test_cases[1])
@django_db_all
def test_force_sampling_mode_in_table(dataset, query, mode):
    owner = Factories.create_user()
    organization = Factories.create_organization(owner=owner)

    end = datetime.now(timezone.utc)
    start = end - timedelta(days=1)
    snuba_params = SnubaParams(start=start, end=end, organization=organization)
    config = SearchResolverConfig()
    resolver = dataset.get_resolver(snuba_params, config)

    table_query = TableQuery(query, ["test"], None, 0, 1, "TestReferrer", None, resolver)
    rpc_request = RPCBase.get_table_rpc_request(table_query)

    assert rpc_request.rpc_request.meta.downsampled_storage_config.mode == mode


@pytest.mark.parametrize(
    ["dataset"],
    [
        pytest.param(Spans, id="spans"),
        pytest.param(OurLogs, id="ourlogs"),
        pytest.param(Occurrences, id="occurrences"),
    ],
)
@pytest.mark.parametrize(trace_id_test_cases[0], trace_id_test_cases[1])
@django_db_all
def test_force_sampling_mode_in_timeseries(dataset, query, mode):
    owner = Factories.create_user()
    organization = Factories.create_organization(owner=owner)

    end = datetime.now(timezone.utc)
    start = end - timedelta(days=1)
    snuba_params = SnubaParams(start=start, end=end, granularity_secs=60, organization=organization)
    config = SearchResolverConfig()
    resolver = dataset.get_resolver(snuba_params, config)

    rpc_request, _, _ = RPCBase.get_timeseries_query(
        search_resolver=resolver,
        params=snuba_params,
        query_string=query,
        y_axes=["avg(tags[foo,number])"],
        groupby=[],
        referrer="TestReferrer",
        sampling_mode=None,
    )

    assert rpc_request.meta.downsampled_storage_config.mode == mode
