from datetime import datetime, timedelta

import pytest
from google.protobuf.timestamp_pb2 import Timestamp
from sentry_protos.snuba.v1.request_common_pb2 import TraceItemType

from sentry.testutils.cases import SnubaTestCase, TestCase
from sentry.testutils.helpers.datetime import before_now
from sentry.testutils.silo import cell_silo_test
from sentry.workflow_engine.debug import DebuggerContext, query_debugger_artifacts
from sentry.workflow_engine.processors.evaluations.eap import EAPAttributeValue, _build_trace_item

NOW = before_now(minutes=1).replace(microsecond=0)
EVENT_ID = "1234567890abcdef1234567890abcdef"


@pytest.mark.snuba_ci
@cell_silo_test
class WorkflowDebuggerSnubaTest(TestCase, SnubaTestCase):
    def make_artifact(
        self,
        attributes: dict[str, EAPAttributeValue],
        *,
        organization_id: int,
        project_id: int,
        timestamp: datetime = NOW,
    ):
        proto_timestamp = Timestamp()
        proto_timestamp.FromDatetime(timestamp)
        return _build_trace_item(
            organization_id=organization_id,
            project_id=project_id,
            timestamp=proto_timestamp,
            attributes=attributes,
        )

    def assert_real_type14_query_isolates_item_tenant_project_and_time(
        self, item_type, item_id, attributes, other_attributes
    ) -> None:
        other_org = self.create_organization()
        other_project = self.create_project(organization=self.organization)
        scope = {"organization_id": self.organization.id, "project_id": self.project.id}
        matching = self.make_artifact(
            {**attributes, "triggered": False, "issue_status": 0}, **scope
        )
        other_id = self.make_artifact(other_attributes, **scope)
        other_tenant = self.make_artifact(
            attributes, organization_id=other_org.id, project_id=self.project.id
        )
        other_project_item = self.make_artifact(
            attributes, organization_id=self.organization.id, project_id=other_project.id
        )
        outside_window = self.make_artifact(attributes, timestamp=NOW - timedelta(hours=2), **scope)
        other_type = self.make_artifact(attributes, **scope)
        other_type.item_type = TraceItemType.TRACE_ITEM_TYPE_PREPROD
        self.store_eap_items(
            [matching, other_id, other_tenant, other_project_item, outside_window, other_type]
        )
        context = DebuggerContext(
            organization=self.organization,
            project_ids=[self.project.id],
            item={
                "type": item_type,
                "id": item_id,
                "organizationId": str(self.organization.id),
                "projectId": str(self.project.id),
                "name": "debugger item",
                "context": {},
            },
        )

        result = query_debugger_artifacts(
            context, start=NOW - timedelta(hours=1), end=NOW + timedelta(seconds=1)
        )

        assert len(result.artifacts) == 1
        artifact = result.artifacts[0]
        assert artifact["itemId"] == matching.item_id.hex()
        assert artifact["traceId"] == matching.trace_id
        assert artifact["projectId"] == str(self.project.id)
        assert artifact["attributes"]["triggered"] is False
        assert artifact["attributes"]["issue_status"] == 0
        assert artifact["attributes"].get("is_new") is None
        assert result.truncated is False

    def test_real_missing_attributes_json_and_event_correlation(self) -> None:
        scope = {"organization_id": self.organization.id, "project_id": self.project.id}
        workflow_item = self.make_artifact(
            {
                "workflow_id": 123,
                "event_id": EVENT_ID,
                "triggered": False,
                "trigger_evaluation": {"result": False, "input": None},
                "filter_evaluations": [{"result": True}],
                "triggered_action_ids": [1, 2],
            },
            **scope,
        )
        detector_item = self.make_artifact(
            {"detector_id": 456, "event_id": EVENT_ID, "outcome": "ok"}, **scope
        )
        unrelated = self.make_artifact(
            {"detector_id": 456, "event_id": "f" * 32, "outcome": "ok"}, **scope
        )
        self.store_eap_items([workflow_item, detector_item, unrelated])
        context = DebuggerContext(
            organization=self.organization,
            project_ids=[self.project.id],
            item={
                "type": "workflow",
                "id": "123",
                "organizationId": str(self.organization.id),
                "projectId": None,
                "name": "debugger workflow",
                "context": {},
            },
        )

        result = query_debugger_artifacts(
            context, start=NOW - timedelta(hours=1), end=NOW + timedelta(seconds=1)
        )

        assert {row["itemId"] for row in result.artifacts} == {
            workflow_item.item_id.hex(),
            detector_item.item_id.hex(),
        }
        by_id = {row["itemId"]: row["attributes"] for row in result.artifacts}
        workflow = by_id[workflow_item.item_id.hex()]
        assert workflow["triggered"] is False
        assert workflow["trigger_evaluation"] == {"result": False, "input": None}
        assert workflow["filter_evaluations"] == [{"result": True}]
        assert workflow["triggered_action_ids"] == [1, 2]
        assert workflow.get("detector_id") is None
        detector = by_id[detector_item.item_id.hex()]
        assert detector["detector_id"] == 456
        assert detector.get("triggered") is None
        assert detector.get("workflow_id") is None
        assert result.truncated is False

    def test_real_workflow_type14_query_scope(self) -> None:
        self.assert_real_type14_query_isolates_item_tenant_project_and_time(
            "workflow", "123", {"workflow_id": 123}, {"workflow_id": 999}
        )

    def test_real_detector_type14_query_scope(self) -> None:
        self.assert_real_type14_query_isolates_item_tenant_project_and_time(
            "detector", "456", {"detector_id": 456}, {"detector_id": 999}
        )

    def test_real_group_type14_query_scope(self) -> None:
        self.assert_real_type14_query_isolates_item_tenant_project_and_time(
            "group", "789", {"group_id": 789}, {"group_id": 999}
        )

    def test_real_event_type14_query_scope(self) -> None:
        self.assert_real_type14_query_isolates_item_tenant_project_and_time(
            "event", EVENT_ID, {"event_id": EVENT_ID}, {"event_id": "f" * 32}
        )
