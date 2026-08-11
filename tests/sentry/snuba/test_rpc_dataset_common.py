from datetime import datetime, timedelta, timezone
from typing import Any
from unittest import mock
from unittest.mock import MagicMock

import pytest
from sentry_conventions.attributes import ATTRIBUTE_NAMES
from sentry_protos.snuba.v1.downsampled_storage_pb2 import DownsampledStorageConfig
from sentry_protos.snuba.v1.trace_item_attribute_pb2 import AttributeValue

from sentry.exceptions import InvalidSearchQuery
from sentry.search.eap.types import SearchResolverConfig, SupportedTraceItemType
from sentry.search.events.types import SnubaParams
from sentry.snuba.occurrences_rpc import Occurrences
from sentry.snuba.ourlogs import OurLogs
from sentry.snuba.rpc_dataset_common import LimitBy, RPCBase, TableQuery
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
        assert final_data[0]["attr"] == "x" * 10 + "..."

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


@django_db_all
def test_table_orderby_rejects_hidden_api_attribute() -> None:
    owner = Factories.create_user()
    organization = Factories.create_organization(owner=owner)
    project = Factories.create_project(organization=organization)
    end = datetime.now(timezone.utc)
    start = end - timedelta(days=1)
    snuba_params = SnubaParams(start=start, end=end, organization=organization, projects=[project])
    config = SearchResolverConfig(api_attribute_visibility_item_type=SupportedTraceItemType.SPANS)
    resolver = Spans.get_resolver(snuba_params, config)
    hidden_attribute = f"tags[{ATTRIBUTE_NAMES.SENTRY_DSC_TRACE_ID.removeprefix('sentry.')}]"

    table_query = TableQuery(
        "",
        [hidden_attribute],
        [hidden_attribute],
        0,
        1,
        "TestReferrer",
        None,
        resolver,
    )

    with pytest.raises(
        InvalidSearchQuery, match="orderby must also be in the selected columns or groupby"
    ):
        RPCBase.get_table_rpc_request(table_query)


def test_table_orderby_rejects_hidden_remapped_virtual_context_sort_attribute() -> None:
    organization = mock.Mock(id=1)
    project = mock.Mock(id=1, slug="project-slug", organization=organization)
    end = datetime.now(timezone.utc)
    start = end - timedelta(days=1)
    snuba_params = SnubaParams(start=start, end=end, organization=organization, projects=[project])
    config = SearchResolverConfig(api_attribute_visibility_item_type=SupportedTraceItemType.SPANS)
    resolver = Spans.get_resolver(snuba_params, config)

    table_query = TableQuery(
        "",
        ["device.class", "count()"],
        ["device.class"],
        0,
        1,
        "TestReferrer",
        None,
        resolver,
    )

    def can_expose(attribute: str, *_args: Any, **_kwargs: Any) -> bool:
        return attribute != "sentry.device.class"

    with (
        mock.patch("sentry.search.eap.utils.can_expose_attribute_to_api", can_expose),
        pytest.raises(
            InvalidSearchQuery, match="orderby must also be in the selected columns or groupby"
        ),
    ):
        RPCBase.get_table_rpc_request(table_query)


@django_db_all
def test_table_limit_by_builds_rpc_request() -> None:
    owner = Factories.create_user()
    organization = Factories.create_organization(owner=owner)
    project = Factories.create_project(organization=organization)
    end = datetime.now(timezone.utc)
    start = end - timedelta(days=1)
    snuba_params = SnubaParams(start=start, end=end, organization=organization, projects=[project])
    resolver = Spans.get_resolver(snuba_params, SearchResolverConfig())

    table_query = TableQuery(
        "",
        ["span.op", "count()"],
        None,
        0,
        50,
        "TestReferrer",
        None,
        resolver,
        limit_by=LimitBy(columns=["span.op"], limit=5),
    )
    rpc_request = RPCBase.get_table_rpc_request(table_query).rpc_request

    assert rpc_request.HasField("limit_by")
    assert rpc_request.limit_by.limit == 5
    expected_key = resolver.resolve_column("span.op")[0].proto_definition
    assert [column.key for column in rpc_request.limit_by.columns] == [expected_key]


@pytest.mark.parametrize(
    ["limit_by", "sampling_mode", "match"],
    [
        pytest.param(
            LimitBy(columns=["span.description"], limit=5),
            None,
            "must be a selected non-aggregate column",
            id="not-selected",
        ),
        pytest.param(
            LimitBy(columns=["count()"], limit=5),
            None,
            "must be a selected non-aggregate column",
            id="aggregate",
        ),
        pytest.param(
            LimitBy(columns=["span.op"], limit=0),
            None,
            "greater than 0",
            id="zero-limit",
        ),
        pytest.param(
            LimitBy(columns=[], limit=5),
            None,
            "at least one column",
            id="no-columns",
        ),
        pytest.param(
            LimitBy(columns=["span.op"], limit=5),
            "HIGHEST_ACCURACY_FLEX_TIME",
            "flextime",
            id="flextime",
        ),
    ],
)
@django_db_all
def test_table_limit_by_rejects_invalid_input(limit_by, sampling_mode, match) -> None:
    owner = Factories.create_user()
    organization = Factories.create_organization(owner=owner)
    project = Factories.create_project(organization=organization)
    end = datetime.now(timezone.utc)
    start = end - timedelta(days=1)
    snuba_params = SnubaParams(start=start, end=end, organization=organization, projects=[project])
    resolver = Spans.get_resolver(snuba_params, SearchResolverConfig())

    table_query = TableQuery(
        "",
        ["span.op", "count()"],
        None,
        0,
        50,
        "TestReferrer",
        sampling_mode,
        resolver,
        limit_by=limit_by,
    )

    with pytest.raises(InvalidSearchQuery, match=match):
        RPCBase.get_table_rpc_request(table_query)


@django_db_all
def test_timeseries_groupby_rejects_hidden_api_attribute() -> None:
    owner = Factories.create_user()
    organization = Factories.create_organization(owner=owner)
    project = Factories.create_project(organization=organization)
    end = datetime.now(timezone.utc)
    start = end - timedelta(days=1)
    snuba_params = SnubaParams(
        start=start,
        end=end,
        granularity_secs=60,
        organization=organization,
        projects=[project],
    )
    config = SearchResolverConfig(api_attribute_visibility_item_type=SupportedTraceItemType.SPANS)
    resolver = Spans.get_resolver(snuba_params, config)
    hidden_attribute = f"tags[{ATTRIBUTE_NAMES.SENTRY_DSC_TRACE_ID.removeprefix('sentry.')}]"

    with pytest.raises(InvalidSearchQuery, match="Could not parse"):
        RPCBase.get_timeseries_query(
            search_resolver=resolver,
            params=snuba_params,
            query_string="",
            y_axes=["count()"],
            groupby=[hidden_attribute],
            referrer="TestReferrer",
            sampling_mode=None,
        )


def test_timeseries_groupby_rejects_hidden_remapped_virtual_context_attribute() -> None:
    organization = mock.Mock(id=1)
    project = mock.Mock(id=1, slug="project-slug", organization=organization)
    end = datetime.now(timezone.utc)
    start = end - timedelta(days=1)
    snuba_params = SnubaParams(
        start=start,
        end=end,
        granularity_secs=60,
        organization=organization,
        projects=[project],
    )
    config = SearchResolverConfig(api_attribute_visibility_item_type=SupportedTraceItemType.SPANS)
    resolver = Spans.get_resolver(snuba_params, config)

    def can_expose(attribute: str, *_args: Any, **_kwargs: Any) -> bool:
        return attribute != "sentry.category"

    with (
        mock.patch("sentry.search.eap.utils.can_expose_attribute_to_api", can_expose),
        pytest.raises(InvalidSearchQuery, match="Could not parse"),
    ):
        RPCBase.get_timeseries_query(
            search_resolver=resolver,
            params=snuba_params,
            query_string="",
            y_axes=["count()"],
            groupby=["span.module"],
            referrer="TestReferrer",
            sampling_mode=None,
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
