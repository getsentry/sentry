from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock

import pytest
from sentry_protos.snuba.v1.downsampled_storage_pb2 import DownsampledStorageConfig
from sentry_protos.snuba.v1.trace_item_attribute_pb2 import AttributeValue

from sentry.search.eap.types import SearchResolverConfig
from sentry.search.events.types import SnubaParams
from sentry.snuba.occurrences_rpc import Occurrences
from sentry.snuba.ourlogs import OurLogs
from sentry.snuba.rpc_dataset_common import RPCBase, TableQuery
from sentry.snuba.spans_rpc import Spans
from sentry.testutils.cases import TestCase
from sentry.testutils.factories import Factories
from sentry.testutils.pytest.fixtures import django_db_all


def _make_column_value(string_values: list[str]) -> MagicMock:
    column_value = MagicMock()
    results = []
    for val in string_values:
        av = AttributeValue()
        av.val_str = val
        results.append(av)
    column_value.results = results
    return column_value


def _identity_column() -> MagicMock:
    resolved_column = MagicMock()
    resolved_column.process_column = lambda v: v
    return resolved_column


class TestProcessColumnValuesTruncation(TestCase):
    def test_truncates_long_strings(self) -> None:
        long_str = "x" * 100
        final_data: list[dict] = [{}]
        RPCBase.process_column_values(
            _make_column_value([long_str]),
            final_data,
            "attr",
            _identity_column(),
            max_string_length=10,
        )
        assert final_data[0]["attr"] == "x" * 10

    def test_no_truncation_without_param(self) -> None:
        long_str = "x" * 100
        final_data: list[dict] = [{}]
        RPCBase.process_column_values(
            _make_column_value([long_str]),
            final_data,
            "attr",
            _identity_column(),
        )
        assert final_data[0]["attr"] == long_str

    def test_does_not_truncate_non_string_values(self) -> None:
        av = AttributeValue()
        av.val_int = 42
        column_value = MagicMock()
        column_value.results = [av]
        final_data: list[dict] = [{}]
        RPCBase.process_column_values(
            column_value,
            final_data,
            "attr",
            _identity_column(),
            max_string_length=1,
        )
        assert final_data[0]["attr"] == 42

    def test_null_values_are_unchanged(self) -> None:
        av = AttributeValue()
        av.is_null = True
        column_value = MagicMock()
        column_value.results = [av]
        final_data: list[dict] = [{}]
        RPCBase.process_column_values(
            column_value,
            final_data,
            "attr",
            _identity_column(),
            max_string_length=1,
        )
        assert final_data[0]["attr"] is None


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
