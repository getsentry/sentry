from datetime import UTC, timedelta
from unittest.mock import patch

import pytest
from django.http import Http404
from sentry_protos.snuba.v1.downsampled_storage_pb2 import DownsampledStorageConfig
from sentry_protos.snuba.v1.endpoint_trace_item_table_pb2 import (
    TraceItemColumnValues,
    TraceItemTableResponse,
)
from sentry_protos.snuba.v1.request_common_pb2 import TraceItemType
from sentry_protos.snuba.v1.trace_item_attribute_pb2 import AttributeKey, AttributeValue, IntArray
from sentry_protos.snuba.v1.trace_item_filter_pb2 import ComparisonFilter

from sentry.constants import ObjectStatus
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.datetime import before_now
from sentry.testutils.silo import cell_silo_test
from sentry.workflow_engine.artifacts import (
    ArtifactTarget,
    query_artifacts,
    resolve_artifact_target,
)
from sentry.workflow_engine.models import Workflow

NOW = before_now(minutes=1).replace(microsecond=0)
EVENT_ID = "1234567890abcdef1234567890abcdef"


def table_response(rows: list[dict[str, AttributeValue]]) -> TraceItemTableResponse:
    names = dict.fromkeys(name for row in rows for name in row)
    return TraceItemTableResponse(
        column_values=[
            TraceItemColumnValues(
                attribute_name=name,
                results=[row.get(name, AttributeValue(is_null=True)) for row in rows],
            )
            for name in names
        ]
    )


def artifact_row(
    item_id: int,
    *,
    project_id: int,
    trace_id: str = "a" * 32,
    seconds_ago: int = 0,
    **attributes: AttributeValue,
) -> dict[str, AttributeValue]:
    return {
        "itemId": AttributeValue(val_str=f"{item_id:032x}"),
        "traceId": AttributeValue(val_str=trace_id),
        "timestamp": AttributeValue(val_double=(NOW - timedelta(seconds=seconds_ago)).timestamp()),
        "projectId": AttributeValue(val_int=project_id),
        **attributes,
    }


@cell_silo_test
class ResolveArtifactTargetTest(TestCase):
    def test_hidden_pending_deletion_workflow_scopes_to_every_org_project(self):
        project = self.project
        workflow = self.create_workflow(
            type=Workflow.Type.INBOX, status=ObjectStatus.PENDING_DELETION, enabled=False
        )
        other_project = self.create_project()
        self.create_project(organization=self.create_organization())

        target = resolve_artifact_target("workflow", str(workflow.id))

        assert target.instance == workflow
        assert target.organization.id == workflow.organization_id
        assert target.project_ids == [project.id, other_project.id]

    def test_detector_scopes_to_its_project(self):
        detector = self.create_detector(project=self.project)
        self.create_project()

        target = resolve_artifact_target("detector", str(detector.id))

        assert target.instance == detector
        assert target.organization.id == self.organization.id
        assert target.project_ids == [self.project.id]

    def test_projectless_detector_uses_configured_organization(self):
        org = self.create_organization()
        project = self.create_project(organization=org)
        detector = self.create_all_projects_detector(org)
        self.create_project()

        target = resolve_artifact_target("detector", str(detector.id))

        assert target.organization.id == org.id
        assert target.project_ids == [project.id]

    def test_group_scopes_to_its_project(self):
        group = self.create_group(project=self.project)
        self.create_project()

        target = resolve_artifact_target("group", str(group.id))

        assert target.instance == group
        assert target.organization.id == self.organization.id
        assert target.project_ids == [self.project.id]

    def test_event_lookup_is_scoped_to_the_requested_project_and_tenant(self):
        event = self.store_event(
            data={"event_id": EVENT_ID, "message": "artifact event", "timestamp": NOW.timestamp()},
            project_id=self.project.id,
        )
        with patch(
            "sentry.workflow_engine.artifacts.eventstore.backend.get_event_by_id",
            return_value=event,
        ) as get_event:
            target = resolve_artifact_target("event", EVENT_ID, self.project)

        get_event.assert_called_once_with(
            self.project.id, EVENT_ID, tenant_ids={"organization_id": self.organization.id}
        )
        assert target.instance == event
        assert target.project_ids == [self.project.id]

    def test_event_missing_in_selected_project_is_not_found(self):
        with patch(
            "sentry.workflow_engine.artifacts.eventstore.backend.get_event_by_id", return_value=None
        ):
            with pytest.raises(Http404):
                resolve_artifact_target("event", EVENT_ID, self.project)

    def test_missing_database_object_is_not_found(self):
        for item_type in ("workflow", "detector", "group"):
            with pytest.raises(Http404):
                resolve_artifact_target(item_type, str(2**63 - 1))


@cell_silo_test
class QueryArtifactsTest(TestCase):
    def target(self, item_type="workflow", item_id="123", project_ids=None):
        return ArtifactTarget(
            type=item_type,
            id=item_id,
            organization=self.organization,
            project_ids=[self.project.id] if project_ids is None else project_ids,
            instance=self.create_workflow(),
        )

    def assert_transport_request_enforces_item_tenant_project_time_and_storage(
        self, item_type, item_id, attribute, attribute_type, value
    ):
        project = self.create_project()
        target = self.target(item_type, item_id, [self.project.id, project.id])
        start = NOW - timedelta(days=1)
        with patch(
            "sentry.workflow_engine.artifacts.table_rpc", return_value=[TraceItemTableResponse()]
        ) as rpc:
            result = query_artifacts(target, start=start, end=NOW)

        assert result.artifacts == []
        assert result.truncated is False
        rpc.assert_called_once()
        request = rpc.call_args.args[0][0]
        assert request.meta.organization_id == self.organization.id
        assert list(request.meta.project_ids) == [self.project.id, project.id]
        assert (
            request.meta.trace_item_type
            == TraceItemType.TRACE_ITEM_TYPE_WORKFLOW_ENGINE_EVALUATION
            == 14
        )
        assert request.meta.start_timestamp.ToDatetime(tzinfo=UTC) == start
        assert request.meta.end_timestamp.ToDatetime(tzinfo=UTC) == NOW
        assert (
            request.meta.downsampled_storage_config.mode
            == DownsampledStorageConfig.MODE_HIGHEST_ACCURACY
        )
        assert request.filter.comparison_filter.key.name == attribute
        assert request.filter.comparison_filter.key.type == attribute_type
        assert request.filter.comparison_filter.op == ComparisonFilter.OP_EQUALS
        assert request.filter.comparison_filter.value == value
        assert request.limit == 101
        assert [(order.column.key.name, order.descending) for order in request.order_by] == [
            ("sentry.timestamp", True),
            ("sentry.item_id", True),
        ]

    def test_no_projects_means_no_unscoped_query(self):
        with patch("sentry.workflow_engine.artifacts.table_rpc") as rpc:
            result = query_artifacts(
                self.target(project_ids=[]), start=NOW - timedelta(days=1), end=NOW
            )
        assert result.artifacts == []
        assert result.truncated is False
        rpc.assert_not_called()

    def test_missing_values_are_not_false_or_zero_and_json_is_decoded(self):
        rows = [
            artifact_row(
                1,
                project_id=self.project.id,
                triggered=AttributeValue(val_bool=False),
                issue_status=AttributeValue(val_int=0),
                detector_id=AttributeValue(is_null=True),
                group_id=AttributeValue(),
                triggered_action_ids=AttributeValue(val_int_array=IntArray(values=[1, 2])),
                trigger_evaluation=AttributeValue(val_str='{"result":false,"input":null}'),
                filter_evaluations=AttributeValue(val_str='[{"result":true}]'),
                delayed=AttributeValue(val_str='{"scheduled":0}'),
            ),
            artifact_row(
                2,
                project_id=self.project.id,
                trigger_evaluation=AttributeValue(val_str="invalid historical JSON"),
            ),
        ]
        with patch(
            "sentry.workflow_engine.artifacts.table_rpc", return_value=[table_response(rows)]
        ) as rpc:
            result = query_artifacts(self.target(), start=NOW - timedelta(days=1), end=NOW)

        rpc.assert_called_once()
        by_id = {artifact["itemId"]: artifact for artifact in result.artifacts}
        attributes = by_id[f"{1:032x}"]["attributes"]
        assert attributes["triggered"] is False
        assert attributes["issue_status"] == 0
        assert attributes.get("detector_id") is None
        assert attributes.get("group_id") is None
        assert attributes["triggered_action_ids"] == [1, 2]
        assert attributes["trigger_evaluation"] == {"result": False, "input": None}
        assert attributes["filter_evaluations"] == [{"result": True}]
        assert attributes["delayed"] == {"scheduled": 0}
        assert by_id[f"{2:032x}"]["attributes"]["trigger_evaluation"] == "invalid historical JSON"
        assert by_id[f"{1:032x}"]["projectId"] == str(self.project.id)

    def assert_primary_row_cap_and_truncation(self, count, truncated):
        rows = [artifact_row(i, project_id=self.project.id) for i in range(count, 0, -1)]
        with patch(
            "sentry.workflow_engine.artifacts.table_rpc", return_value=[table_response(rows)]
        ) as rpc:
            result = query_artifacts(self.target(), start=NOW - timedelta(days=1), end=NOW)
        assert len(result.artifacts) == 100
        assert result.truncated is truncated
        assert result.artifacts[0]["itemId"] == f"{count:032x}"
        rpc.assert_called_once()

    def test_event_lookup_preserves_all_primary_rows_without_correlation_query(self):
        rows = [
            artifact_row(
                index,
                project_id=self.project.id,
                event_id=AttributeValue(val_str=EVENT_ID),
                **{attribute: AttributeValue(val_int=index)},
            )
            for index, attribute in enumerate(("workflow_id", "detector_id", "group_id"), 1)
        ]
        with patch(
            "sentry.workflow_engine.artifacts.table_rpc", return_value=[table_response(rows)]
        ) as rpc:
            result = query_artifacts(
                self.target("event", EVENT_ID), start=NOW - timedelta(days=1), end=NOW
            )

        rpc.assert_called_once()
        assert [artifact["itemId"] for artifact in result.artifacts] == [
            f"{index:032x}" for index in (3, 2, 1)
        ]
        by_id = {artifact["itemId"]: artifact for artifact in result.artifacts}
        for index, attribute in enumerate(("workflow_id", "detector_id", "group_id"), 1):
            assert by_id[f"{index:032x}"]["attributes"][attribute] == index
            assert by_id[f"{index:032x}"]["attributes"]["event_id"] == EVENT_ID
        assert result.truncated is False

    def test_event_backed_correlation_is_scoped_deduplicated_sorted_and_not_recursive(self):
        primary = artifact_row(
            1, project_id=self.project.id, seconds_ago=1, event_id=AttributeValue(val_str=EVENT_ID)
        )
        related = artifact_row(
            2, project_id=self.project.id, detector_id=AttributeValue(val_int=456)
        )
        related_other_project = artifact_row(1, project_id=self.project.id + 1)
        target = self.target(project_ids=[self.project.id, self.project.id + 1])
        with patch(
            "sentry.workflow_engine.artifacts.table_rpc",
            side_effect=[
                [table_response([primary])],
                [table_response([related, primary, related_other_project])],
            ],
        ) as rpc:
            result = query_artifacts(target, start=NOW - timedelta(days=1), end=NOW)

        assert rpc.call_count == 2
        first = rpc.call_args_list[0].args[0][0]
        expansion = rpc.call_args_list[1].args[0][0]
        assert expansion.meta == first.meta
        assert expansion.limit == 101
        assert expansion.filter.comparison_filter.key.name == "sentry.trace_id"
        assert expansion.filter.comparison_filter.op == ComparisonFilter.OP_IN
        assert list(expansion.filter.comparison_filter.value.val_str_array.values) == ["a" * 32]
        assert len(result.artifacts) == 3
        assert {(row["projectId"], row["itemId"]) for row in result.artifacts} == {
            (str(self.project.id), f"{1:032x}"),
            (str(self.project.id), f"{2:032x}"),
            (str(self.project.id + 1), f"{1:032x}"),
        }
        assert result.artifacts[0]["itemId"] == f"{2:032x}"
        assert result.truncated is False

    def test_eventless_detector_trace_does_not_expand(self):
        row = artifact_row(1, project_id=self.project.id, detector_id=AttributeValue(val_int=123))
        with patch(
            "sentry.workflow_engine.artifacts.table_rpc", return_value=[table_response([row])]
        ) as rpc:
            query_artifacts(self.target("detector"), start=NOW - timedelta(days=1), end=NOW)
        rpc.assert_called_once()

    def test_correlation_trace_cap_marks_truncation(self):
        rows = [
            artifact_row(
                i,
                project_id=self.project.id,
                trace_id=f"{i:032x}",
                event_id=AttributeValue(val_str=f"{i:032x}"),
            )
            for i in range(51, 0, -1)
        ]
        with patch(
            "sentry.workflow_engine.artifacts.table_rpc",
            side_effect=[[table_response(rows)], [TraceItemTableResponse()]],
        ) as rpc:
            result = query_artifacts(self.target(), start=NOW - timedelta(days=1), end=NOW)
        assert rpc.call_count == 2
        expansion = rpc.call_args_list[1].args[0][0]
        assert len(expansion.filter.comparison_filter.value.val_str_array.values) == 50
        assert result.truncated is True

    def test_expansion_row_cap_marks_truncation_and_bounds_total_results(self):
        primary = artifact_row(
            1000, project_id=self.project.id, event_id=AttributeValue(val_str=EVENT_ID)
        )
        expansion = [artifact_row(i, project_id=self.project.id) for i in range(101, 0, -1)]
        with patch(
            "sentry.workflow_engine.artifacts.table_rpc",
            side_effect=[[table_response([primary])], [table_response(expansion)]],
        ) as rpc:
            result = query_artifacts(self.target(), start=NOW - timedelta(days=1), end=NOW)
        assert rpc.call_count == 2
        assert len(result.artifacts) == 101
        assert result.truncated is True

    def test_workflow_transport_request_scope_and_types(self):
        self.assert_transport_request_enforces_item_tenant_project_time_and_storage(
            "workflow", "123", "workflow_id", AttributeKey.TYPE_INT, AttributeValue(val_int=123)
        )

    def test_detector_transport_request_scope_and_types(self):
        self.assert_transport_request_enforces_item_tenant_project_time_and_storage(
            "detector", "456", "detector_id", AttributeKey.TYPE_INT, AttributeValue(val_int=456)
        )

    def test_group_transport_request_scope_and_types(self):
        self.assert_transport_request_enforces_item_tenant_project_time_and_storage(
            "group", "789", "group_id", AttributeKey.TYPE_INT, AttributeValue(val_int=789)
        )

    def test_event_transport_request_scope_and_types(self):
        self.assert_transport_request_enforces_item_tenant_project_time_and_storage(
            "event",
            EVENT_ID,
            "event_id",
            AttributeKey.TYPE_STRING,
            AttributeValue(val_str=EVENT_ID),
        )

    def test_primary_exactly_at_row_cap_is_not_truncated(self):
        self.assert_primary_row_cap_and_truncation(100, False)

    def test_primary_over_row_cap_is_truncated(self):
        self.assert_primary_row_cap_and_truncation(101, True)
