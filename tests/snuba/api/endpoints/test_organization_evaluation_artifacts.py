from datetime import timedelta
from typing import Any

from google.protobuf.timestamp_pb2 import Timestamp
from requests.utils import parse_header_links
from rest_framework.test import APIClient
from sentry_protos.snuba.v1.trace_item_pb2 import TraceItem

from sentry.models.project import Project
from sentry.testutils.cases import APITestCase, SnubaTestCase
from sentry.testutils.helpers.datetime import before_now
from sentry.testutils.silo import cell_silo_test
from sentry.workflow_engine.endpoints.organization_evaluation_artifacts import FEATURE_FLAG
from sentry.workflow_engine.processors.evaluations.detector import (
    DetectorEvaluation,
    ProcessDetectorsResult,
)
from sentry.workflow_engine.processors.evaluations.eap import (
    _build_trace_item,
    _evaluation_attributes,
)
from sentry.workflow_engine.types import DetectorPriorityLevel


@cell_silo_test
class OrganizationEvaluationArtifactsTest(APITestCase, SnubaTestCase):
    endpoint = "sentry-api-0-organization-evaluation-artifacts"

    def setUp(self) -> None:
        super().setUp()
        self.login_as(self.user)
        self.timestamp = before_now(minutes=1).replace(microsecond=0)
        self.feature_context = self.feature(FEATURE_FLAG)
        self.feature_context.__enter__()
        self.addCleanup(self.feature_context.__exit__, None, None, None)

    def store_artifact(
        self, attributes: dict[str, Any] | None = None, project: Project | None = None
    ) -> TraceItem:
        project = project or self.project
        timestamp = Timestamp()
        timestamp.FromDatetime(self.timestamp)
        item = _build_trace_item(
            organization_id=project.organization_id,
            project_id=project.id,
            attributes={
                "evaluation_type": "detector",
                "outcome": "completed",
                "project_id": project.id,
                **(attributes or {}),
            },
            timestamp=timestamp,
        )
        self.store_eap_items([item])
        return item

    def test_filters_and_shared_condition_serialization(self) -> None:
        condition = {
            "triggered": False,
            "logic_type": "all",
            "result": False,
            "condition_evaluations": [
                {
                    "condition_id": 12,
                    "condition_type": "eq",
                    "input_type": "dict",
                    "comparison": "null",
                    "input": {"original_key": None, "values": [None, False, 0]},
                    "triggered": False,
                    "result": 0,
                }
            ],
        }
        detector = self.store_artifact(
            {
                "detector_id": 10,
                "triggered": False,
                "priority": 0,
                "trigger_evaluation": condition,
            }
        )
        workflow = self.store_artifact(
            {
                "evaluation_type": "workflow",
                "evaluation_phase": "delayed",
                "workflow_id": 20,
                "detector_id": 10,
                "group_id": 30,
                "outcome": "not_triggered",
                "triggered": False,
                "trigger_evaluation": condition,
                "filter_evaluations": [],
                "triggered_action_ids": [],
                "delayed": {"filter_group_ids": [40], "passing_filter_group_ids": []},
            }
        )
        self.store_artifact({"detector_id": 11, "outcome": "error"})

        response = self.get_success_response(
            self.organization.slug,
            detector_id=10,
            outcome=["completed", "not_triggered"],
        )
        artifacts = {row["id"]: row for row in response.data}
        assert set(artifacts) == {detector.item_id.hex(), workflow.item_id.hex()}
        detector_data = artifacts[detector.item_id.hex()]
        workflow_data = artifacts[workflow.item_id.hex()]
        assert (
            detector_data["triggerEvaluation"]
            == workflow_data["triggerEvaluation"]
            == {
                "triggered": False,
                "logicType": "all",
                "result": False,
                "conditionEvaluations": [
                    {
                        "conditionId": "12",
                        "conditionType": "eq",
                        "inputType": "dict",
                        "comparison": "null",
                        "input": {"original_key": None, "values": [None, False, 0]},
                        "triggered": False,
                        "result": 0,
                    }
                ],
            }
        )
        assert detector_data["priority"] == 0
        assert "workflowId" not in detector_data
        assert "error" not in workflow_data
        assert workflow_data["triggeredActionIds"] == []
        assert workflow_data["delayed"] == {"filterGroupIds": ["40"], "passingFilterGroupIds": []}

    def test_string_filters_preserve_whitespace(self) -> None:
        error = "  evaluation failed\n"
        item = self.store_artifact({"outcome": "error", "error": error})

        response = self.get_success_response(self.organization.slug, error=error)
        assert [row["id"] for row in response.data] == [item.item_id.hex()]
        assert response.data[0]["error"] == error
        response = self.get_success_response(self.organization.slug, error=error.strip())
        assert response.data == []
        response = self.get_success_response(self.organization.slug, outcome=" error ")
        assert response.data == []

    def test_detector_without_condition_group(self) -> None:
        evaluation = DetectorEvaluation(
            data={
                "group_key": "group-key",
                "trigger_group_evaluation": None,
                "event_data": {"event_id": "a" * 32},
            },
            triggered=True,
            priority=DetectorPriorityLevel.HIGH,
        )
        result = ProcessDetectorsResult(
            detector_id=10,
            detector_type="synthetic",
            project_id=self.project.id,
            evaluations={"group-key": evaluation},
        )
        item = self.store_artifact(next(_evaluation_attributes(result)))

        response = self.get_success_response(self.organization.slug, detector_id=10)
        assert response.data == [
            {
                "id": item.item_id.hex(),
                "traceId": item.trace_id,
                "timestamp": self.timestamp.isoformat().replace("+00:00", "Z"),
                "projectId": str(self.project.id),
                "evaluationType": "detector",
                "outcome": "triggered",
                "detectorId": "10",
                "detectorType": "synthetic",
                "eventId": "a" * 32,
                "triggered": True,
                "groupKey": "group-key",
                "priority": DetectorPriorityLevel.HIGH.value,
            }
        ]

    def test_optional_issue_state_preserves_false_and_zero(self) -> None:
        item = self.store_artifact(
            {
                "evaluation_type": "workflow",
                "workflow_id": 20,
                "outcome": "not_triggered",
                "triggered": False,
                "priority": 0,
                "event_kind": "activity",
                "issue_status": 0,
                "issue_substatus": 0,
                "issue_priority": 0,
                "environment_id": 0,
                "is_resolved": False,
                "is_new": False,
                "is_regression": False,
                "is_new_group_environment": False,
                "has_escalated": False,
                "activity_type": 0,
                "triggered_action_ids": [],
            }
        )

        response = self.get_success_response(self.organization.slug, workflow_id=20)
        assert response.data == [
            {
                "id": item.item_id.hex(),
                "traceId": item.trace_id,
                "timestamp": self.timestamp.isoformat().replace("+00:00", "Z"),
                "projectId": str(self.project.id),
                "evaluationType": "workflow",
                "outcome": "not_triggered",
                "triggered": False,
                "priority": 0,
                "workflowId": "20",
                "eventKind": "activity",
                "issueStatus": 0,
                "issueSubstatus": 0,
                "issuePriority": 0,
                "environmentId": "0",
                "isResolved": False,
                "isNew": False,
                "isRegression": False,
                "isNewGroupEnvironment": False,
                "hasEscalated": False,
                "activityType": 0,
                "triggeredActionIds": [],
            }
        ]

    def test_action_arrays_and_activity_types(self) -> None:
        item = self.store_artifact(
            {
                "evaluation_type": "workflow",
                "workflow_id": 20,
                "outcome": "actions_triggered",
                "triggered_action_ids": [50, 60],
                "activity_type": 1234,
            }
        )
        other = self.store_artifact(
            {
                "evaluation_type": "workflow",
                "workflow_id": 21,
                "outcome": "actions_triggered",
                "triggered_action_ids": [70],
                "activity_type": "set_resolved",
            }
        )
        response = self.get_success_response(self.organization.slug, workflow_id=20)
        assert [row["id"] for row in response.data] == [item.item_id.hex()]
        assert response.data[0]["triggeredActionIds"] == ["50", "60"]
        assert response.data[0]["activityType"] == 1234
        response = self.get_success_response(self.organization.slug, workflow_id=21)
        assert [row["id"] for row in response.data] == [other.item_id.hex()]
        assert response.data[0]["triggeredActionIds"] == ["70"]
        assert response.data[0]["activityType"] == "set_resolved"

    def test_unsupported_attributes_do_not_filter(self) -> None:
        first = self.store_artifact(
            {
                "evaluation_type": "workflow",
                "workflow_id": 20,
                "outcome": "actions_triggered",
                "triggered": True,
                "triggered_action_ids": [50],
                "activity_type": 1234,
            }
        )
        second = self.store_artifact(
            {
                "evaluation_type": "workflow",
                "workflow_id": 21,
                "outcome": "not_triggered",
                "triggered": False,
                "triggered_action_ids": [],
                "activity_type": "set_resolved",
            }
        )
        response = self.get_success_response(
            self.organization.slug,
            item_id=first.item_id.hex(),
            trace_id=first.trace_id,
            triggered="true",
            triggered_action_ids=50,
            activity_type=1234,
            trigger_evaluation="{}",
        )
        assert {row["id"] for row in response.data} == {
            first.item_id.hex(),
            second.item_id.hex(),
        }

    def test_pagination_with_equal_timestamps_and_terminal_page(self) -> None:
        first = self.store_artifact({"detector_id": 1})
        second = self.store_artifact({"detector_id": 2})
        third = self.store_artifact({"detector_id": 3})
        ids = sorted([first.item_id.hex(), second.item_id.hex(), third.item_id.hex()], reverse=True)
        params = {
            "start": (self.timestamp - timedelta(hours=1)).isoformat(),
            "end": (self.timestamp + timedelta(seconds=1)).isoformat(),
            "per_page": 2,
        }
        response = self.get_success_response(self.organization.slug, **params)
        assert [row["id"] for row in response.data] == ids[:2]
        next_link = parse_header_links(response["Link"])[1]
        assert next_link["results"] == "true"
        response = self.get_success_response(
            self.organization.slug, cursor=next_link["cursor"], **params
        )
        assert [row["id"] for row in response.data] == ids[2:]
        links = parse_header_links(response["Link"])
        assert links[0]["results"] == "true"
        assert links[1]["results"] == "false"
        previous = self.get_success_response(
            self.organization.slug, cursor=links[0]["cursor"], **params
        )
        assert [row["id"] for row in previous.data] == ids[:2]

    def test_organization_and_project_isolation(self) -> None:
        self.organization.flags.allow_joinleave = False
        self.organization.save()
        team = self.create_team(organization=self.organization)
        allowed = self.create_project(organization=self.organization, teams=[team])
        denied = self.create_project(organization=self.organization)
        other_org = self.create_organization()
        foreign = self.create_project(organization=other_org)
        user = self.create_user()
        self.create_member(user=user, organization=self.organization, role="member", teams=[team])
        visible = self.store_artifact({"outcome": "error", "detector_id": 10}, allowed)
        self.store_artifact({"outcome": "error", "detector_id": 10}, denied)
        self.store_artifact({"outcome": "error", "detector_id": 10}, foreign)
        self.login_as(user)
        response = self.get_success_response(self.organization.slug, detector_id=10)
        assert [row["id"] for row in response.data] == [visible.item_id.hex()]
        self.get_error_response(self.organization.slug, project=denied.id, status_code=403)
        self.get_error_response(self.organization.slug, project=foreign.id, status_code=403)
        response = self.get_success_response(self.organization.slug, project_id=denied.id)
        assert response.data == []

    def test_batch_outcome_without_evaluations(self) -> None:
        item = self.store_artifact(
            {
                "evaluation_type": "workflow",
                "evaluation_phase": "delayed",
                "outcome": "no_workflows",
            }
        )
        response = self.get_success_response(
            self.organization.slug, evaluation_type="workflow", evaluation_phase="delayed"
        )
        assert response.data == [
            {
                "id": item.item_id.hex(),
                "traceId": item.trace_id,
                "timestamp": self.timestamp.isoformat().replace("+00:00", "Z"),
                "projectId": str(self.project.id),
                "evaluationType": "workflow",
                "evaluationPhase": "delayed",
                "outcome": "no_workflows",
            }
        ]

    def test_long_window_includes_retained_artifacts(self) -> None:
        item = self.store_artifact()
        response = self.get_success_response(self.organization.slug, statsPeriod="90d")
        assert [row["id"] for row in response.data] == [item.item_id.hex()]

    def test_expired_window_excludes_recent_artifacts(self) -> None:
        self.store_artifact()
        response = self.get_success_response(
            self.organization.slug,
            start=(self.timestamp - timedelta(days=9)).isoformat(),
            end=(self.timestamp - timedelta(days=8)).isoformat(),
        )
        assert response.data == []

    def test_invalid_id(self) -> None:
        response = self.get_error_response(self.organization.slug, workflow_id="x", status_code=400)
        assert "detail" in response.data

    def test_invalid_evaluation_type(self) -> None:
        response = self.get_error_response(
            self.organization.slug, evaluation_type="other", status_code=400
        )
        assert "detail" in response.data

    def test_invalid_date_range(self) -> None:
        response = self.get_error_response(
            self.organization.slug, start="invalid", end="invalid", status_code=400
        )
        assert "detail" in response.data

    def test_invalid_cursor(self) -> None:
        response = self.get_error_response(
            self.organization.slug, cursor="invalid", status_code=400
        )
        assert "detail" in response.data

    def test_alert_read_token(self) -> None:
        item = self.store_artifact()
        token = self.create_user_auth_token(self.user, scope_list=["alerts:read"])
        self.client = APIClient()
        response = self.get_success_response(
            self.organization.slug,
            extra_headers={"HTTP_AUTHORIZATION": f"Bearer {token.plaintext_token}"},
        )
        assert [row["id"] for row in response.data] == [item.item_id.hex()]

    def test_token_without_alert_read_scope(self) -> None:
        token = self.create_user_auth_token(self.user, scope_list=["event:read"])
        self.client = APIClient()
        self.get_error_response(
            self.organization.slug,
            status_code=403,
            extra_headers={"HTTP_AUTHORIZATION": f"Bearer {token.plaintext_token}"},
        )

    def test_requires_feature(self) -> None:
        with self.feature({FEATURE_FLAG: False}):
            self.get_error_response(self.organization.slug, status_code=404)
