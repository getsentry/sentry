from unittest import mock

from django.db.models import Q
from rest_framework.exceptions import ErrorDetail

from sentry.api.serializers import serialize
from sentry.grouping.grouptype import ErrorGroupType
from sentry.incidents.grouptype import MetricIssue
from sentry.incidents.models.alert_rule import AlertRuleDetectionType
from sentry.models.environment import Environment
from sentry.search.utils import _HACKY_INVALID_USER
from sentry.snuba.dataset import Dataset
from sentry.snuba.models import (
    QuerySubscription,
    QuerySubscriptionDataSourceHandler,
    SnubaQuery,
    SnubaQueryEventType,
)
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.features import apply_feature_flag_on_cls
from sentry.testutils.silo import region_silo_test
from sentry.uptime.grouptype import UptimeDomainCheckFailure
from sentry.uptime.types import DATA_SOURCE_UPTIME_SUBSCRIPTION
from sentry.workflow_engine.endpoints.organization_detector_index import convert_assignee_values
from sentry.workflow_engine.models import DataCondition, DataConditionGroup, DataSource, Detector
from sentry.workflow_engine.models.data_condition import Condition
from sentry.workflow_engine.models.detector_workflow import DetectorWorkflow
from sentry.workflow_engine.registry import data_source_type_registry
from sentry.workflow_engine.types import DetectorPriorityLevel


class OrganizationDetectorIndexBaseTest(APITestCase):
    endpoint = "sentry-api-0-organization-detector-index"

    def setUp(self) -> None:
        super().setUp()
        self.login_as(user=self.user)
        self.environment = Environment.objects.create(
            organization_id=self.organization.id, name="production"
        )
        self.data_condition_group = self.create_data_condition_group(
            organization_id=self.organization.id,
            logic_type=DataConditionGroup.Type.ANY,
        )


@region_silo_test
class OrganizationDetectorIndexGetTest(OrganizationDetectorIndexBaseTest):

    def test_simple(self) -> None:
        detector = self.create_detector(
            project_id=self.project.id, name="Test Detector", type=MetricIssue.slug
        )
        detector_2 = self.create_detector(
            project_id=self.project.id, name="Test Detector 2", type=MetricIssue.slug
        )
        response = self.get_success_response(
            self.organization.slug, qs_params={"project": self.project.id}
        )
        assert response.data == serialize([detector, detector_2])

    def test_uptime_detector(self) -> None:
        subscription = self.create_uptime_subscription()
        data_source = self.create_data_source(
            organization_id=self.organization.id,
            source_id=subscription.id,
            type=DATA_SOURCE_UPTIME_SUBSCRIPTION,
        )
        detector = self.create_detector(
            project_id=self.project.id,
            name="Test Detector",
            type=UptimeDomainCheckFailure.slug,
            config={
                "mode": 1,
                "environment": "production",
            },
        )
        self.create_data_source_detector(
            data_source=data_source,
            detector=detector,
        )
        response = self.get_success_response(
            self.organization.slug, qs_params={"project": self.project.id}
        )
        assert response.data[0]["dataSources"][0]["queryObj"] == serialize(subscription)

    def test_empty_result(self) -> None:
        response = self.get_success_response(
            self.organization.slug, qs_params={"project": self.project.id}
        )
        assert len(response.data) == 0

    def test_project_unspecified(self) -> None:
        d1 = self.create_detector(
            project=self.project, name="A Test Detector", type=MetricIssue.slug
        )
        d2 = self.create_detector(
            project=self.create_project(organization=self.organization),
            name="B Test Detector 2",
            type=MetricIssue.slug,
        )
        response = self.get_success_response(
            self.organization.slug,
        )
        assert {d["name"] for d in response.data} == {d1.name, d2.name}

    def test_invalid_project(self) -> None:
        self.create_detector(project=self.project, name="A Test Detector", type=MetricIssue.slug)

        # project might exist, but you're not allowed to know that.
        self.get_error_response(
            self.organization.slug,
            qs_params={"project": 512345},
            status_code=403,
        )

    def test_filter_by_ids(self) -> None:
        detector = self.create_detector(
            project_id=self.project.id, name="Test Detector", type=MetricIssue.slug
        )
        detector_2 = self.create_detector(
            project_id=self.project.id, name="Test Detector 2", type=MetricIssue.slug
        )
        self.create_detector(
            project_id=self.project.id, name="Test Detector 3", type=MetricIssue.slug
        )

        response = self.get_success_response(
            self.organization.slug,
            qs_params=[("id", str(detector.id)), ("id", str(detector_2.id))],
        )
        assert len(response.data) == 2
        assert {d["id"] for d in response.data} == {str(detector.id), str(detector_2.id)}

        # Test with non-existent ID
        response = self.get_success_response(
            self.organization.slug,
            qs_params={"id": "999999"},
        )
        assert len(response.data) == 0

        # Test with invalid ID format
        response = self.get_error_response(
            self.organization.slug,
            qs_params={"id": "not-an-id"},
            status_code=400,
        )
        assert response.data == {"id": ["Invalid ID format"]}

    def test_invalid_sort_by(self) -> None:
        response = self.get_error_response(
            self.organization.slug,
            qs_params={"project": self.project.id, "sortBy": "general_malaise"},
        )
        assert "sortBy" in response.data

    def test_sort_by_name(self) -> None:
        detector = self.create_detector(
            project_id=self.project.id, name="A Test Detector", type=MetricIssue.slug
        )
        detector_2 = self.create_detector(
            project_id=self.project.id, name="B Test Detector 2", type=MetricIssue.slug
        )
        response = self.get_success_response(
            self.organization.slug, qs_params={"project": self.project.id, "sortBy": "-name"}
        )
        assert [d["name"] for d in response.data] == [
            detector_2.name,
            detector.name,
        ]

    def test_sort_by_connected_workflows(self) -> None:
        workflow = self.create_workflow(
            organization_id=self.organization.id,
        )
        workflow_2 = self.create_workflow(
            organization_id=self.organization.id,
        )
        detector = self.create_detector(
            project_id=self.project.id, name="Test Detector", type=MetricIssue.slug
        )
        detector_2 = self.create_detector(
            project_id=self.project.id, name="Test Detector 2", type=MetricIssue.slug
        )
        self.create_detector_workflow(detector=detector, workflow=workflow)
        self.create_detector_workflow(detector=detector, workflow=workflow_2)
        response1 = self.get_success_response(
            self.organization.slug,
            qs_params={"project": self.project.id, "sortBy": "-connectedWorkflows"},
        )
        assert [d["name"] for d in response1.data] == [
            detector.name,
            detector_2.name,
        ]
        response2 = self.get_success_response(
            self.organization.slug,
            qs_params={"project": self.project.id, "sortBy": "connectedWorkflows"},
        )
        assert [d["name"] for d in response2.data] == [
            detector_2.name,
            detector.name,
        ]

    def test_query_by_name(self) -> None:
        detector = self.create_detector(
            project_id=self.project.id, name="Apple Detector", type=MetricIssue.slug
        )
        detector2 = self.create_detector(
            project_id=self.project.id, name="Green Apple Detector", type=MetricIssue.slug
        )
        self.create_detector(
            project_id=self.project.id, name="Banana Detector", type=MetricIssue.slug
        )
        response = self.get_success_response(
            self.organization.slug, qs_params={"project": self.project.id, "query": "apple"}
        )
        assert {d["name"] for d in response.data} == {detector.name, detector2.name}

        # Exact insensitive match when explicitly by name
        response = self.get_success_response(
            self.organization.slug,
            qs_params={"project": self.project.id, "query": 'name:"Apple Detector"'},
        )
        assert {d["name"] for d in response.data} == {detector.name}

    def test_query_by_type(self) -> None:
        detector = self.create_detector(
            project_id=self.project.id, name="Detector 1", type=MetricIssue.slug
        )
        detector2 = self.create_detector(
            project_id=self.project.id,
            name="Detector 2",
            type=ErrorGroupType.slug,
        )
        response = self.get_success_response(
            self.organization.slug, qs_params={"project": self.project.id, "query": "type:error"}
        )
        assert {d["name"] for d in response.data} == {detector2.name}

        # Query for multiple types.
        response2 = self.get_success_response(
            self.organization.slug,
            qs_params={"project": self.project.id, "query": "type:[error, metric_issue]"},
        )
        assert {d["name"] for d in response2.data} == {detector.name, detector2.name}

        response3 = self.get_success_response(
            self.organization.slug,
            qs_params={"project": self.project.id, "query": "!type:metric_issue"},
        )
        assert {d["name"] for d in response3.data} == {detector2.name}

    def test_general_query(self) -> None:
        detector = self.create_detector(
            project_id=self.project.id,
            name="Lookfor 1",
            type=MetricIssue.slug,
            description="Delicious",
        )
        detector2 = self.create_detector(
            project_id=self.project.id,
            name="Lookfor 2",
            type=ErrorGroupType.slug,
            description="Exciting",
        )
        response = self.get_success_response(
            self.organization.slug, qs_params={"project": self.project.id, "query": "delicious"}
        )
        assert {d["name"] for d in response.data} == {detector.name}

        response2 = self.get_success_response(
            self.organization.slug, qs_params={"project": self.project.id, "query": "metric"}
        )
        assert {d["name"] for d in response2.data} == {detector.name}

        response3 = self.get_success_response(
            self.organization.slug, qs_params={"project": self.project.id, "query": "lookfor"}
        )
        assert {d["name"] for d in response3.data} == {detector.name, detector2.name}

    def test_query_by_assignee_user_email(self) -> None:
        user = self.create_user(email="assignee@example.com")
        self.create_member(organization=self.organization, user=user)

        assigned_detector = self.create_detector(
            project_id=self.project.id,
            name="Assigned Detector",
            type=MetricIssue.slug,
            owner_user_id=user.id,
        )
        self.create_detector(
            project_id=self.project.id,
            name="Unassigned Detector",
            type=MetricIssue.slug,
        )

        response = self.get_success_response(
            self.organization.slug,
            qs_params={"project": self.project.id, "query": f"assignee:{user.email}"},
        )
        assert {d["name"] for d in response.data} == {assigned_detector.name}

    def test_query_by_assignee_user_username(self) -> None:
        user = self.create_user(username="testuser")
        self.create_member(organization=self.organization, user=user)

        assigned_detector = self.create_detector(
            project_id=self.project.id,
            name="Assigned Detector",
            type=MetricIssue.slug,
            owner_user_id=user.id,
        )
        self.create_detector(
            project_id=self.project.id,
            name="Unassigned Detector",
            type=MetricIssue.slug,
        )

        response = self.get_success_response(
            self.organization.slug,
            qs_params={"project": self.project.id, "query": f"assignee:{user.username}"},
        )
        assert {d["name"] for d in response.data} == {assigned_detector.name}

    def test_query_by_assignee_team(self) -> None:
        team = self.create_team(organization=self.organization, slug="test-team")
        self.project.add_team(team)

        assigned_detector = self.create_detector(
            project_id=self.project.id,
            name="Team Detector",
            type=MetricIssue.slug,
            owner_team_id=team.id,
        )
        self.create_detector(
            project_id=self.project.id,
            name="Unassigned Detector",
            type=MetricIssue.slug,
        )

        response = self.get_success_response(
            self.organization.slug,
            qs_params={"project": self.project.id, "query": f"assignee:#{team.slug}"},
        )
        assert {d["name"] for d in response.data} == {assigned_detector.name}

    def test_query_by_assignee_me(self) -> None:
        self.login_as(user=self.user)

        assigned_detector = self.create_detector(
            project_id=self.project.id,
            name="My Detector",
            type=MetricIssue.slug,
            owner_user_id=self.user.id,
        )
        self.create_detector(
            project_id=self.project.id,
            name="Other Detector",
            type=MetricIssue.slug,
        )

        response = self.get_success_response(
            self.organization.slug,
            qs_params={"project": self.project.id, "query": "assignee:me"},
        )
        assert {d["name"] for d in response.data} == {assigned_detector.name}

    def test_query_by_assignee_none(self) -> None:
        user = self.create_user()
        self.create_member(organization=self.organization, user=user)
        team = self.create_team(organization=self.organization)

        self.create_detector(
            project_id=self.project.id,
            name="User Assigned",
            type=MetricIssue.slug,
            owner_user_id=user.id,
        )
        self.create_detector(
            project_id=self.project.id,
            name="Team Assigned",
            type=MetricIssue.slug,
            owner_team_id=team.id,
        )
        unassigned_detector = self.create_detector(
            project_id=self.project.id,
            name="Unassigned Detector",
            type=MetricIssue.slug,
        )

        response = self.get_success_response(
            self.organization.slug,
            qs_params={"project": self.project.id, "query": "assignee:none"},
        )
        assert {d["name"] for d in response.data} == {unassigned_detector.name}

    def test_query_by_assignee_multiple_values(self) -> None:
        user = self.create_user(email="user1@example.com")
        self.create_member(organization=self.organization, user=user)
        team = self.create_team(organization=self.organization, slug="test-team")
        self.project.add_team(team)

        detector1 = self.create_detector(
            project_id=self.project.id,
            name="Detector 1",
            type=MetricIssue.slug,
            owner_user_id=user.id,
        )
        detector2 = self.create_detector(
            project_id=self.project.id,
            name="Detector 2",
            type=MetricIssue.slug,
            owner_team_id=team.id,
        )
        self.create_detector(
            project_id=self.project.id,
            name="Other Detector",
            type=MetricIssue.slug,
        )

        response = self.get_success_response(
            self.organization.slug,
            qs_params={
                "project": self.project.id,
                "query": f"assignee:[{user.email}, #{team.slug}]",
            },
        )
        assert {d["name"] for d in response.data} == {detector1.name, detector2.name}

    def test_query_by_assignee_negation(self) -> None:
        user = self.create_user(email="exclude@example.com")
        self.create_member(organization=self.organization, user=user)

        self.create_detector(
            project_id=self.project.id,
            name="Excluded Detector",
            type=MetricIssue.slug,
            owner_user_id=user.id,
        )
        included_detector = self.create_detector(
            project_id=self.project.id,
            name="Included Detector",
            type=MetricIssue.slug,
        )

        response = self.get_success_response(
            self.organization.slug,
            qs_params={"project": self.project.id, "query": f"!assignee:{user.email}"},
        )
        assert {d["name"] for d in response.data} == {included_detector.name}

    def test_query_by_assignee_invalid_user(self) -> None:
        self.create_detector(
            project_id=self.project.id,
            name="Valid Detector",
            type=MetricIssue.slug,
        )

        # Query with non-existent user should return no results
        response = self.get_success_response(
            self.organization.slug,
            qs_params={"project": self.project.id, "query": "assignee:nonexistent@example.com"},
        )
        assert len(response.data) == 0


@region_silo_test
@apply_feature_flag_on_cls("organizations:incidents")
class OrganizationDetectorIndexPostTest(OrganizationDetectorIndexBaseTest):
    method = "POST"

    def setUp(self) -> None:
        super().setUp()
        self.connected_workflow = self.create_workflow(
            organization_id=self.organization.id,
        )
        self.valid_data = {
            "name": "Test Detector",
            "type": MetricIssue.slug,
            "projectId": self.project.id,
            "dataSource": {
                "queryType": SnubaQuery.Type.ERROR.value,
                "dataset": Dataset.Events.name.lower(),
                "query": "test query",
                "aggregate": "count()",
                "timeWindow": 3600,
                "environment": self.environment.name,
                "eventTypes": [SnubaQueryEventType.EventType.ERROR.name.lower()],
            },
            "conditionGroup": {
                "id": self.data_condition_group.id,
                "organizationId": self.organization.id,
                "logicType": self.data_condition_group.logic_type,
                "conditions": [
                    {
                        "type": Condition.GREATER,
                        "comparison": 100,
                        "conditionResult": DetectorPriorityLevel.HIGH,
                        "conditionGroupId": self.data_condition_group.id,
                    }
                ],
            },
            "config": {
                "thresholdPeriod": 1,
                "detectionType": AlertRuleDetectionType.STATIC.value,
            },
            "workflowIds": [self.connected_workflow.id],
        }

    def test_missing_group_type(self) -> None:
        data = {**self.valid_data}
        del data["type"]
        response = self.get_error_response(
            self.organization.slug,
            **data,
            status_code=400,
        )
        assert response.data == {"type": ["This field is required."]}

    def test_invalid_group_type(self) -> None:
        data = {**self.valid_data, "type": "invalid_type"}
        response = self.get_error_response(
            self.organization.slug,
            **data,
            status_code=400,
        )
        assert response.data == {
            "type": ["Unknown detector type 'invalid_type'. Must be one of: error"]
        }

    def test_incompatible_group_type(self) -> None:
        with mock.patch("sentry.issues.grouptype.registry.get_by_slug") as mock_get:
            mock_get.return_value = mock.Mock(detector_settings=None)
            data = {**self.valid_data, "type": "incompatible_type"}
            response = self.get_error_response(
                self.organization.slug,
                **data,
                status_code=400,
            )
            assert response.data == {"type": ["Detector type not compatible with detectors"]}

    def test_missing_project_id(self) -> None:
        data = {**self.valid_data}
        del data["projectId"]
        response = self.get_error_response(
            self.organization.slug,
            **data,
            status_code=400,
        )
        assert response.data == {"projectId": ["This field is required."]}

    def test_project_id_not_found(self) -> None:
        data = {**self.valid_data}
        data["projectId"] = 123456
        response = self.get_error_response(
            self.organization.slug,
            **data,
            status_code=400,
        )
        assert response.data == {"projectId": ["Project not found"]}

    def test_wrong_org_project_id(self) -> None:
        data = {**self.valid_data}
        data["projectId"] = self.create_project(organization=self.create_organization()).id
        response = self.get_error_response(
            self.organization.slug,
            **data,
            status_code=400,
        )
        assert response.data == {"projectId": ["Project not found"]}

    def test_without_feature_flag(self) -> None:
        with self.feature({"organizations:incidents": False}):
            response = self.get_error_response(
                self.organization.slug,
                **self.valid_data,
                status_code=404,
            )
        assert response.data == {
            "detail": ErrorDetail(string="The requested resource does not exist", code="error")
        }

    @mock.patch("sentry.workflow_engine.endpoints.validators.base.detector.create_audit_entry")
    def test_valid_creation(self, mock_audit):
        with self.tasks():
            response = self.get_success_response(
                self.organization.slug,
                **self.valid_data,
                status_code=201,
            )

        detector = Detector.objects.get(id=response.data["id"])
        assert response.data == serialize([detector])[0]
        assert detector.name == "Test Detector"
        assert detector.type == MetricIssue.slug
        assert detector.project_id == self.project.id

        # Verify data source
        data_source = DataSource.objects.get(detector=detector)
        assert data_source.type == data_source_type_registry.get_key(
            QuerySubscriptionDataSourceHandler
        )
        assert data_source.organization_id == self.organization.id

        # Verify query subscription
        query_sub = QuerySubscription.objects.get(id=int(data_source.source_id))
        assert query_sub.project == self.project
        assert query_sub.snuba_query.type == SnubaQuery.Type.ERROR.value
        assert query_sub.snuba_query.dataset == Dataset.Events.value
        assert query_sub.snuba_query.query == "test query"
        assert query_sub.snuba_query.aggregate == "count()"
        assert query_sub.snuba_query.time_window == 3600
        assert query_sub.snuba_query.environment == self.environment
        assert query_sub.snuba_query.event_types == [SnubaQueryEventType.EventType.ERROR]

        # Verify condition group and conditions
        condition_group = detector.workflow_condition_group
        assert condition_group
        assert condition_group.logic_type == DataConditionGroup.Type.ANY
        assert condition_group.organization_id == self.organization.id

        conditions = list(DataCondition.objects.filter(condition_group=condition_group))
        assert len(conditions) == 1
        condition = conditions[0]
        assert condition.type == Condition.GREATER
        assert condition.comparison == 100
        assert condition.condition_result == DetectorPriorityLevel.HIGH

        # Verify connected workflows
        detector_workflow = DetectorWorkflow.objects.get(
            detector=detector, workflow=self.connected_workflow
        )
        assert detector_workflow.detector == detector
        assert detector_workflow.workflow == self.connected_workflow

        # Verify audit log
        mock_audit.assert_called_once_with(
            request=mock.ANY,
            organization=self.organization,
            target_object=detector.id,
            event=mock.ANY,
            data=detector.get_audit_log_data(),
        )

    def test_invalid_workflow_ids(self) -> None:
        # Workflow doesn't exist at all
        data = {**self.valid_data, "workflowIds": [999999]}
        response = self.get_error_response(
            self.organization.slug,
            **data,
            status_code=400,
        )
        assert "Some workflows do not exist" in str(response.data)

        # Workflow that exists but is in another org should also fail validation
        other_org = self.create_organization()
        other_workflow = self.create_workflow(organization_id=other_org.id)
        data = {**self.valid_data, "workflowIds": [other_workflow.id]}
        response = self.get_error_response(
            self.organization.slug,
            **data,
            status_code=400,
        )
        assert "Some workflows do not exist" in str(response.data)

    def test_transaction_rollback_on_workflow_validation_failure(self) -> None:
        initial_detector_count = Detector.objects.filter(project=self.project).count()

        # Try to create detector with invalid workflow, get an error response back
        data = {**self.valid_data, "workflowIds": [999999]}
        response = self.get_error_response(
            self.organization.slug,
            **data,
            status_code=400,
        )

        # Verify that the detector was never created (same number of detectors as before)
        final_detector_count = Detector.objects.filter(project=self.project).count()
        assert final_detector_count == initial_detector_count
        assert "Some workflows do not exist" in str(response.data)

    def test_missing_required_field(self) -> None:
        response = self.get_error_response(
            self.organization.slug,
            status_code=400,
        )
        assert response.data == {"type": ["This field is required."]}

    def test_missing_name(self) -> None:
        data = {**self.valid_data}
        del data["name"]
        response = self.get_error_response(
            self.organization.slug,
            **data,
            status_code=400,
        )
        assert response.data == {"name": ["This field is required."]}

    def test_empty_query_string(self) -> None:
        data = {**self.valid_data}
        data["dataSource"]["query"] = ""

        with self.tasks():
            response = self.get_success_response(
                self.organization.slug,
                **data,
                status_code=201,
            )

        detector = Detector.objects.get(id=response.data["id"])
        data_source = DataSource.objects.get(detector=detector)
        query_sub = QuerySubscription.objects.get(id=int(data_source.source_id))

        assert query_sub.snuba_query.query == ""

    def test_valid_creation_with_owner(self) -> None:
        # Test data with owner field
        data_with_owner = {
            **self.valid_data,
            "owner": self.user.get_actor_identifier(),
        }

        with self.tasks():
            response = self.get_success_response(
                self.organization.slug,
                **data_with_owner,
                status_code=201,
            )

        detector = Detector.objects.get(id=response.data["id"])

        # Verify owner is set correctly
        assert detector.owner_user_id == self.user.id
        assert detector.owner_team_id is None
        assert detector.owner is not None
        assert detector.owner.identifier == self.user.get_actor_identifier()

        # Verify serialized response includes owner
        assert response.data["owner"] == self.user.get_actor_identifier()

    def test_valid_creation_with_team_owner(self) -> None:
        # Create a team for testing
        team = self.create_team(organization=self.organization)

        # Test data with team owner
        data_with_team_owner = {
            **self.valid_data,
            "owner": f"team:{team.id}",
        }

        with self.tasks():
            response = self.get_success_response(
                self.organization.slug,
                **data_with_team_owner,
                status_code=201,
            )

        detector = Detector.objects.get(id=response.data["id"])

        # Verify team owner is set correctly
        assert detector.owner_user_id is None
        assert detector.owner_team_id == team.id
        assert detector.owner is not None
        assert detector.owner.identifier == f"team:{team.id}"

        # Verify serialized response includes team owner
        assert response.data["owner"] == f"team:{team.id}"

    def test_invalid_owner(self) -> None:
        # Test with invalid owner format
        data_with_invalid_owner = {
            **self.valid_data,
            "owner": "invalid:owner:format",
        }

        response = self.get_error_response(
            self.organization.slug,
            **data_with_invalid_owner,
            status_code=400,
        )
        assert "owner" in response.data

    def test_owner_not_in_organization(self) -> None:
        # Create a user in another organization
        other_org = self.create_organization()
        other_user = self.create_user()
        self.create_member(organization=other_org, user=other_user)

        # Test with owner not in current organization
        data_with_invalid_owner = {
            **self.valid_data,
            "owner": other_user.get_actor_identifier(),
        }

        response = self.get_error_response(
            self.organization.slug,
            **data_with_invalid_owner,
            status_code=400,
        )
        assert "owner" in response.data


@region_silo_test
class ConvertAssigneeValuesTest(APITestCase):
    """Test the convert_assignee_values function"""

    def setUp(self) -> None:
        super().setUp()
        self.user = self.create_user()
        self.team = self.create_team(organization=self.organization)
        self.other_user = self.create_user()
        self.create_member(organization=self.organization, user=self.other_user)
        self.projects = [self.project]

    def test_convert_assignee_values_user_email(self) -> None:
        result = convert_assignee_values([self.user.email], self.projects, self.user)
        expected = Q(owner_user_id=self.user.id)
        self.assertEqual(str(result), str(expected))

    def test_convert_assignee_values_user_username(self) -> None:
        result = convert_assignee_values([self.user.username], self.projects, self.user)
        expected = Q(owner_user_id=self.user.id)
        self.assertEqual(str(result), str(expected))

    def test_convert_assignee_values_team_slug(self) -> None:
        result = convert_assignee_values([f"#{self.team.slug}"], self.projects, self.user)
        expected = Q(owner_team_id=self.team.id)
        self.assertEqual(str(result), str(expected))

    def test_convert_assignee_values_me(self) -> None:
        result = convert_assignee_values(["me"], self.projects, self.user)
        expected = Q(owner_user_id=self.user.id)
        self.assertEqual(str(result), str(expected))

    def test_convert_assignee_values_none(self) -> None:
        result = convert_assignee_values(["none"], self.projects, self.user)
        expected = Q(owner_team_id__isnull=True, owner_user_id__isnull=True)
        self.assertEqual(str(result), str(expected))

    def test_convert_assignee_values_multiple(self) -> None:
        result = convert_assignee_values(
            [str(self.user.email), f"#{self.team.slug}"], self.projects, self.user
        )
        expected = Q(owner_user_id=self.user.id) | Q(owner_team_id=self.team.id)
        self.assertEqual(str(result), str(expected))

    def test_convert_assignee_values_mixed(self) -> None:
        result = convert_assignee_values(
            ["me", "none", f"#{self.team.slug}"], self.projects, self.user
        )
        expected = (
            Q(owner_user_id=self.user.id)
            | Q(owner_team_id__isnull=True, owner_user_id__isnull=True)
            | Q(owner_team_id=self.team.id)
        )
        self.assertEqual(str(result), str(expected))

    def test_convert_assignee_values_invalid(self) -> None:
        result = convert_assignee_values(["999999"], self.projects, self.user)
        expected = Q(owner_user_id=_HACKY_INVALID_USER.id)
        self.assertEqual(str(result), str(expected))

    def test_convert_assignee_values_empty(self) -> None:
        result = convert_assignee_values([], self.projects, self.user)
        expected = Q()
        self.assertEqual(str(result), str(expected))
