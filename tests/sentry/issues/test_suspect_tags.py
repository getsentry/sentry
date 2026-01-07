import datetime
import time
import uuid
from unittest import mock

from sentry_protos.snuba.v1.endpoint_trace_item_table_pb2 import (
    TraceItemColumnValues,
    TraceItemTableResponse,
)
from sentry_protos.snuba.v1.trace_item_attribute_pb2 import AttributeValue

from sentry.issues.suspect_tags import (
    _query_error_counts_eap,
    get_suspect_tag_scores,
    query_baseline_set,
    query_error_counts,
    query_selection_set,
)
from sentry.search.eap.occurrences.rollout_utils import EAPOccurrencesComparator
from sentry.testutils.cases import SnubaTestCase, TestCase


class SuspectTagsTest(TestCase, SnubaTestCase):
    def mock_event(self, ts, hash="a" * 32, group_id=None, project_id=1, tags=None):
        self.snuba_insert(
            (
                2,
                "insert",
                {
                    "event_id": uuid.uuid4().hex,
                    "primary_hash": hash,
                    "group_id": group_id if group_id else int(hash[:16], 16),
                    "project_id": project_id,
                    "message": "message",
                    "platform": "python",
                    "datetime": ts.strftime("%Y-%m-%dT%H:%M:%S.%fZ"),
                    "data": {
                        "received": time.mktime(ts.timetuple()),
                        "tags": list(tags.items()),
                    },
                },
                {},
            )
        )

    def test_query_baseline_set(self) -> None:
        before = datetime.datetime.now(tz=datetime.UTC) - datetime.timedelta(hours=1)
        today = before + datetime.timedelta(hours=1)
        later = today + datetime.timedelta(hours=1)

        self.mock_event(today, hash="a" * 32, tags={"key": True, "other": False})
        self.mock_event(today, hash="a" * 32, tags={"key": False, "other": False})

        results = query_baseline_set(
            1, 1, before, later, environments=[], tag_keys=["key", "other"]
        )
        assert results == [("key", "false", 1), ("key", "true", 1), ("other", "false", 2)]

    def test_query_selection_set(self) -> None:
        before = datetime.datetime.now(tz=datetime.UTC) - datetime.timedelta(hours=1)
        today = before + datetime.timedelta(hours=1)
        later = today + datetime.timedelta(hours=1)

        self.mock_event(today, hash="a" * 32, tags={"key": True, "other": False}, group_id=1)
        self.mock_event(today, hash="a" * 32, tags={"key": False, "other": False}, group_id=2)

        results = query_selection_set(1, 1, before, later, environments=[], group_id=1)
        assert results == [("key", "true", 1), ("other", "false", 1)]

    def test_get_suspect_tag_scores(self) -> None:
        before = datetime.datetime.now(tz=datetime.UTC) - datetime.timedelta(hours=1)
        today = before + datetime.timedelta(hours=1)
        later = today + datetime.timedelta(hours=1)

        self.mock_event(today, hash="a" * 32, tags={"key": True, "other": False}, group_id=1)
        self.mock_event(today, hash="a" * 32, tags={"key": False, "other": False}, group_id=2)

        results = get_suspect_tag_scores(1, 1, before, later, envs=[], group_id=1)
        assert results == [("key", 2.7622287114272543), ("other", 0.0)]


class QueryErrorCountsTest(TestCase):
    @mock.patch("sentry.snuba.rpc_dataset_common.snuba_rpc.table_rpc")
    def test_returns_count_from_eap(self, mock_table_rpc: mock.MagicMock) -> None:
        organization = self.create_organization()
        project = self.create_project(organization=organization)

        mock_response = TraceItemTableResponse(
            column_values=[
                TraceItemColumnValues(
                    attribute_name="count()",
                    results=[AttributeValue(val_double=42.0)],
                )
            ]
        )
        mock_table_rpc.return_value = [mock_response]

        start = datetime.datetime.now(tz=datetime.UTC) - datetime.timedelta(hours=1)
        end = datetime.datetime.now(tz=datetime.UTC)

        result = _query_error_counts_eap(
            organization_id=organization.id,
            project_id=project.id,
            start=start,
            end=end,
            environment_names=[],
            group_id=3,
        )

        assert result == 42
        mock_table_rpc.assert_called_once()

    @mock.patch("sentry.snuba.rpc_dataset_common.snuba_rpc.table_rpc")
    def test_returns_zero_on_empty_column_values(self, mock_table_rpc: mock.MagicMock) -> None:
        organization = self.create_organization()
        project = self.create_project(organization=organization)

        mock_response = TraceItemTableResponse(column_values=[])
        mock_table_rpc.return_value = [mock_response]

        start = datetime.datetime.now(tz=datetime.UTC) - datetime.timedelta(hours=1)
        end = datetime.datetime.now(tz=datetime.UTC)

        result = _query_error_counts_eap(
            organization_id=organization.id,
            project_id=project.id,
            start=start,
            end=end,
            environment_names=[],
            group_id=71,
        )

        assert result == 0

    @mock.patch("sentry.snuba.rpc_dataset_common.snuba_rpc.table_rpc")
    def test_returns_zero_on_exception(self, mock_table_rpc: mock.MagicMock) -> None:
        organization = self.create_organization()
        project = self.create_project(organization=organization)

        mock_table_rpc.side_effect = Exception("RPC failed")

        start = datetime.datetime.now(tz=datetime.UTC) - datetime.timedelta(hours=1)
        end = datetime.datetime.now(tz=datetime.UTC)

        result = _query_error_counts_eap(
            organization_id=organization.id,
            project_id=project.id,
            start=start,
            end=end,
            environment_names=[],
            group_id=123,
        )

        assert result == 0

    @mock.patch("sentry.issues.suspect_tags._query_error_counts_eap")
    @mock.patch("sentry.issues.suspect_tags._query_error_counts_snuba")
    def test_uses_snuba_as_source_of_truth(
        self,
        mock_snuba: mock.MagicMock,
        mock_eap: mock.MagicMock,
    ) -> None:
        mock_snuba.return_value = 100
        mock_eap.return_value = 50

        start = datetime.datetime.now(tz=datetime.UTC) - datetime.timedelta(hours=1)
        end = datetime.datetime.now(tz=datetime.UTC)

        with self.options({EAPOccurrencesComparator._should_eval_option_name(): True}):
            result = query_error_counts(
                organization_id=1,
                project_id=1,
                start=start,
                end=end,
                environment_names=[],
                group_id=123,
            )

        assert result == 100
        mock_snuba.assert_called_once()
        mock_eap.assert_called_once()

    @mock.patch("sentry.issues.suspect_tags._query_error_counts_eap")
    @mock.patch("sentry.issues.suspect_tags._query_error_counts_snuba")
    def test_uses_eap_as_source_of_truth(
        self,
        mock_snuba: mock.MagicMock,
        mock_eap: mock.MagicMock,
    ) -> None:
        mock_snuba.return_value = 100
        mock_eap.return_value = 50

        start = datetime.datetime.now(tz=datetime.UTC) - datetime.timedelta(hours=1)
        end = datetime.datetime.now(tz=datetime.UTC)

        with self.options(
            {
                EAPOccurrencesComparator._should_eval_option_name(): True,
                EAPOccurrencesComparator._callsite_allowlist_option_name(): [
                    "issues.suspect_tags.query_error_counts"
                ],
            }
        ):
            result = query_error_counts(
                organization_id=1,
                project_id=1,
                start=start,
                end=end,
                environment_names=[],
                group_id=123,
            )

        assert result == 50
        mock_snuba.assert_called_once()
        mock_eap.assert_called_once()
