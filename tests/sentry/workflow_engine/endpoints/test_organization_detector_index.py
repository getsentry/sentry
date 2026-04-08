from collections.abc import Sequence

from django.db.models import Q

from sentry import audit_log
from sentry.api.serializers import serialize
from sentry.constants import ObjectStatus
from sentry.deletions.models.scheduleddeletion import CellScheduledDeletion
from sentry.deletions.tasks.scheduled import run_scheduled_deletions
from sentry.grouping.grouptype import ErrorGroupType
from sentry.incidents.grouptype import MetricIssue
from sentry.incidents.models.alert_rule import AlertRule
from sentry.models.environment import Environment
from sentry.monitors.grouptype import MonitorIncidentType
from sentry.search.utils import _HACKY_INVALID_USER
from sentry.snuba.models import QuerySubscription, SnubaQuery
from sentry.testutils.asserts import assert_org_audit_log_exists
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.datetime import before_now
from sentry.testutils.helpers.features import with_feature
from sentry.testutils.outbox import outbox_runner
from sentry.testutils.silo import cell_silo_test
from sentry.uptime.grouptype import UptimeDomainCheckFailure
from sentry.uptime.types import (
    DATA_SOURCE_UPTIME_SUBSCRIPTION,
)
from sentry.workflow_engine.endpoints.organization_detector_index import convert_assignee_values
from sentry.workflow_engine.migration_helpers.alert_rule import dual_write_alert_rule
from sentry.workflow_engine.models import (
    AlertRuleDetector,
    DataConditionGroup,
    Detector,
)
from sentry.workflow_engine.models.detector_group import DetectorGroup
from sentry.workflow_engine.typings.grouptype import IssueStreamGroupType


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
        self.error_detector = self.create_detector(
            type=ErrorGroupType.slug, project=self.project, name="Error Monitor"
        )
        self.issue_stream_detector = self.create_detector(
            type=IssueStreamGroupType.slug, project=self.project, name="Issue Stream"
        )


@cell_silo_test
class OrganizationDetectorIndexGetTest(OrganizationDetectorIndexBaseTest):
    def test_simple(self) -> None:
        detector = self.create_detector(
            project=self.project, name="Test Detector", type=MetricIssue.slug
        )
        detector_2 = self.create_detector(
            project=self.project, name="Test Detector 2", type=MetricIssue.slug
        )
        response = self.get_success_response(
            self.organization.slug, qs_params={"project": self.project.id}
        )
        assert response.data == serialize(
            [self.error_detector, self.issue_stream_detector, detector, detector_2]
        )

        # Verify openIssues field is present in serialized response
        for detector_data in response.data:
            assert "openIssues" in detector_data
            assert isinstance(detector_data["openIssues"], int)

        # Verify X-Hits header is present and correct
        assert "X-Hits" in response
        hits = int(response["X-Hits"])
        assert hits == 4

    def test_uptime_detector(self) -> None:
        subscription = self.create_uptime_subscription()
        data_source = self.create_data_source(
            organization_id=self.organization.id,
            source_id=subscription.id,
            type=DATA_SOURCE_UPTIME_SUBSCRIPTION,
        )
        detector = self.create_detector(
            project=self.project,
            name="Test Detector",
            type=UptimeDomainCheckFailure.slug,
            config={
                "mode": 1,
                "environment": "production",
                "recovery_threshold": 1,
                "downtime_threshold": 3,
            },
        )
        self.create_data_source_detector(
            data_source=data_source,
            detector=detector,
        )
        response = self.get_success_response(
            self.organization.slug, qs_params={"project": self.project.id}
        )
        assert response.data[2]["dataSources"][0]["queryObj"] == serialize(subscription)

    def test_default_detector_result(self) -> None:
        """
        Test that the only results are the default detectors for a project
        """
        response = self.get_success_response(
            self.organization.slug, qs_params={"project": self.project.id}
        )
        assert len(response.data) == 2
        assert response.data == serialize([self.error_detector, self.issue_stream_detector])

    def test_project_unspecified(self) -> None:
        d1 = self.create_detector(
            project=self.project, name="A Test Detector", type=MetricIssue.slug
        )
        d2 = self.create_detector(
            project=self.create_project(),
            name="B Test Detector 2",
            type=MetricIssue.slug,
        )
        response = self.get_success_response(
            self.organization.slug,
        )

        assert {d["name"] for d in response.data} == {
            d1.name,
            d2.name,
            self.error_detector.name,
            self.issue_stream_detector.name,
        }

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
            project=self.project, name="Test Detector", type=MetricIssue.slug
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
        assert "id" in response.data
        assert "not a valid integer id" in str(response.data["id"])

    def test_invalid_sort_by(self) -> None:
        response = self.get_error_response(
            self.organization.slug,
            qs_params={"project": self.project.id, "sortBy": "general_malaise"},
        )
        assert "sortBy" in response.data

    def test_sort_by_name(self) -> None:
        detector = self.create_detector(
            project=self.project, name="A Test Detector", type=MetricIssue.slug
        )
        detector_2 = self.create_detector(
            project=self.project, name="B Test Detector 2", type=MetricIssue.slug
        )
        response = self.get_success_response(
            self.organization.slug, qs_params={"project": self.project.id, "sortBy": "-name"}
        )
        assert [d["name"] for d in response.data] == [
            self.issue_stream_detector.name,
            self.error_detector.name,
            detector_2.name,
            detector.name,
        ]

    def test_sort_by_connected_workflows(self) -> None:
        # delete the project default detectors as they cause flaky sorting results
        self.error_detector.delete()
        self.issue_stream_detector.delete()

        workflow = self.create_workflow(
            organization_id=self.organization.id,
        )
        workflow_2 = self.create_workflow(
            organization_id=self.organization.id,
        )
        detector = self.create_detector(
            project=self.project, name="Test Detector", type=MetricIssue.slug
        )
        detector_2 = self.create_detector(
            project=self.project, name="Test Detector 2", type=MetricIssue.slug
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

    def test_sort_by_latest_group(self) -> None:
        # delete the project default detectors as they cause flaky sorting results
        self.error_detector.delete()
        self.issue_stream_detector.delete()

        detector_1 = self.create_detector(
            project=self.project, name="Detector 1", type=MetricIssue.slug
        )
        detector_2 = self.create_detector(
            project=self.project, name="Detector 2", type=MetricIssue.slug
        )
        detector_3 = self.create_detector(
            project=self.project, name="Detector 3", type=MetricIssue.slug
        )
        detector_4 = self.create_detector(
            project=self.project, name="Detector 4 No Groups", type=MetricIssue.slug
        )

        group_1 = self.create_group(project=self.project)
        group_2 = self.create_group(project=self.project)
        group_3 = self.create_group(project=self.project)

        # detector_1 has the oldest group
        detector_group_1 = DetectorGroup.objects.create(detector=detector_1, group=group_1)
        detector_group_1.date_added = before_now(hours=3)
        detector_group_1.save()

        # detector_2 has the newest group
        detector_group_2 = DetectorGroup.objects.create(detector=detector_2, group=group_2)
        detector_group_2.date_added = before_now(hours=1)  # Most recent
        detector_group_2.save()

        # detector_3 has one in the middle
        detector_group_3 = DetectorGroup.objects.create(detector=detector_3, group=group_3)
        detector_group_3.date_added = before_now(hours=2)
        detector_group_3.save()

        # Test descending sort (newest groups first)
        response = self.get_success_response(
            self.organization.slug, qs_params={"project": self.project.id, "sortBy": "-latestGroup"}
        )
        assert [d["name"] for d in response.data] == [
            detector_2.name,
            detector_3.name,
            detector_1.name,
            detector_4.name,  # No groups, should be last
        ]

        # Test ascending sort (oldest groups first)
        response2 = self.get_success_response(
            self.organization.slug, qs_params={"project": self.project.id, "sortBy": "latestGroup"}
        )
        assert [d["name"] for d in response2.data] == [
            detector_4.name,  # No groups, should be first
            detector_1.name,
            detector_3.name,
            detector_2.name,
        ]

    def test_sort_by_open_issues(self) -> None:
        # delete the project default detectors as they cause flaky sorting results
        self.error_detector.delete()
        self.issue_stream_detector.delete()

        detector_1 = self.create_detector(
            project=self.project, name="Detector 1", type=MetricIssue.slug
        )
        detector_2 = self.create_detector(
            project=self.project, name="Detector 2", type=MetricIssue.slug
        )
        detector_3 = self.create_detector(
            project=self.project, name="Detector 3", type=MetricIssue.slug
        )
        detector_4 = self.create_detector(
            project=self.project, name="Detector 4 No Groups", type=MetricIssue.slug
        )

        # Create groups with different statuses
        from sentry.models.group import GroupStatus

        # detector_1 has 2 open issues and 1 resolved
        open_group_1 = self.create_group(project=self.project, status=GroupStatus.UNRESOLVED)
        open_group_2 = self.create_group(project=self.project, status=GroupStatus.UNRESOLVED)
        resolved_group_1 = self.create_group(project=self.project, status=GroupStatus.RESOLVED)
        DetectorGroup.objects.create(detector=detector_1, group=open_group_1)
        DetectorGroup.objects.create(detector=detector_1, group=open_group_2)
        DetectorGroup.objects.create(detector=detector_1, group=resolved_group_1)

        # detector_2 has 1 open issue
        open_group_3 = self.create_group(project=self.project, status=GroupStatus.UNRESOLVED)
        DetectorGroup.objects.create(detector=detector_2, group=open_group_3)

        # detector_3 has 3 open issues
        open_group_4 = self.create_group(project=self.project, status=GroupStatus.UNRESOLVED)
        open_group_5 = self.create_group(project=self.project, status=GroupStatus.UNRESOLVED)
        open_group_6 = self.create_group(project=self.project, status=GroupStatus.UNRESOLVED)
        DetectorGroup.objects.create(detector=detector_3, group=open_group_4)
        DetectorGroup.objects.create(detector=detector_3, group=open_group_5)
        DetectorGroup.objects.create(detector=detector_3, group=open_group_6)

        # detector_4 has no groups

        # Test descending sort (most open issues first)
        response = self.get_success_response(
            self.organization.slug, qs_params={"project": self.project.id, "sortBy": "-openIssues"}
        )
        expected_order = [detector_3.name, detector_1.name, detector_2.name, detector_4.name]
        actual_order = [d["name"] for d in response.data]
        assert actual_order == expected_order

        # Verify open issues counts in serialized response
        open_issues_by_name = {d["name"]: d["openIssues"] for d in response.data}
        assert open_issues_by_name[detector_1.name] == 2
        assert open_issues_by_name[detector_2.name] == 1
        assert open_issues_by_name[detector_3.name] == 3
        assert open_issues_by_name[detector_4.name] == 0

        # Test ascending sort (least open issues first)
        response2 = self.get_success_response(
            self.organization.slug, qs_params={"project": self.project.id, "sortBy": "openIssues"}
        )
        expected_order_asc = [detector_4.name, detector_2.name, detector_1.name, detector_3.name]
        actual_order_asc = [d["name"] for d in response2.data]
        assert actual_order_asc == expected_order_asc

    def test_query_by_name(self) -> None:
        detector = self.create_detector(
            project=self.project, name="Apple Detector", type=MetricIssue.slug
        )
        detector2 = self.create_detector(
            project=self.project, name="Green Apple Detector", type=MetricIssue.slug
        )
        self.create_detector(project=self.project, name="Banana Detector", type=MetricIssue.slug)
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
            project=self.project, name="Detector 1", type=MetricIssue.slug
        )
        detector2 = self.create_detector(
            project=self.project,
            name="Detector 2",
            type=ErrorGroupType.slug,
        )
        response = self.get_success_response(
            self.organization.slug, qs_params={"project": self.project.id, "query": "type:error"}
        )
        assert {d["name"] for d in response.data} == {detector2.name}

        issue_stream_resp = self.get_success_response(
            self.organization.slug,
            qs_params={"project": self.project.id, "query": "type:issue_stream"},
        )
        assert {d["name"] for d in issue_stream_resp.data} == {self.issue_stream_detector.name}

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
        assert {d["name"] for d in response3.data} == {
            detector2.name,
            self.issue_stream_detector.name,
        }

    def test_query_by_type_alias(self) -> None:
        """
        Users can query by simplfied aliases like "metric", "uptime" instead of the full type names.
        """
        metric_detector = self.create_detector(
            project=self.project, name="Metric Detector", type=MetricIssue.slug
        )
        uptime_detector = self.create_detector(
            project=self.project,
            name="Uptime Detector",
            type=UptimeDomainCheckFailure.slug,
            config={
                "mode": 1,
                "environment": "production",
                "recovery_threshold": 1,
                "downtime_threshold": 3,
            },
        )
        cron_detector = self.create_detector(
            project=self.project,
            name="Cron Detector",
            type=MonitorIncidentType.slug,
        )

        response = self.get_success_response(
            self.organization.slug, qs_params={"project": self.project.id, "query": "type:metric"}
        )
        assert {d["name"] for d in response.data} == {metric_detector.name}

        response = self.get_success_response(
            self.organization.slug, qs_params={"project": self.project.id, "query": "type:uptime"}
        )
        assert {d["name"] for d in response.data} == {uptime_detector.name}

        response = self.get_success_response(
            self.organization.slug, qs_params={"project": self.project.id, "query": "type:cron"}
        )
        assert {d["name"] for d in response.data} == {cron_detector.name}

    def test_general_query(self) -> None:
        detector = self.create_detector(
            project=self.project,
            name="Lookfor 1",
            type=MetricIssue.slug,
            description="Delicious",
        )
        detector2 = self.create_detector(
            project=self.project,
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

    def test_query_invalid_search_key(self) -> None:
        self.create_detector(project=self.project, name="Test Detector", type=MetricIssue.slug)
        response = self.get_error_response(
            self.organization.slug,
            qs_params={"project": self.project.id, "query": "tpe:metric"},
            status_code=400,
        )
        assert "query" in response.data
        assert "Invalid key for this search: tpe" in str(response.data["query"])

    def test_query_by_assignee_user_email(self) -> None:
        user = self.create_user(email="assignee@example.com")
        self.create_member(organization=self.organization, user=user)

        assigned_detector = self.create_detector(
            project=self.project,
            name="Assigned Detector",
            type=MetricIssue.slug,
            owner_user_id=user.id,
        )
        self.create_detector(
            project=self.project,
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
            project=self.project,
            name="Assigned Detector",
            type=MetricIssue.slug,
            owner_user_id=user.id,
        )
        self.create_detector(
            project=self.project,
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
            project=self.project,
            name="Team Detector",
            type=MetricIssue.slug,
            owner_team_id=team.id,
        )
        self.create_detector(
            project=self.project,
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
            project=self.project,
            name="My Detector",
            type=MetricIssue.slug,
            owner_user_id=self.user.id,
        )
        self.create_detector(
            project=self.project,
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
            project=self.project,
            name="User Assigned",
            type=MetricIssue.slug,
            owner_user_id=user.id,
        )
        self.create_detector(
            project=self.project,
            name="Team Assigned",
            type=MetricIssue.slug,
            owner_team_id=team.id,
        )
        unassigned_detector = self.create_detector(
            project=self.project,
            name="Unassigned Detector",
            type=MetricIssue.slug,
        )

        response = self.get_success_response(
            self.organization.slug,
            qs_params={"project": self.project.id, "query": "assignee:none"},
        )
        assert {d["name"] for d in response.data} == {
            unassigned_detector.name,
            self.error_detector.name,
            self.issue_stream_detector.name,
        }

    def test_query_by_assignee_multiple_values(self) -> None:
        user = self.create_user(email="user1@example.com")
        self.create_member(organization=self.organization, user=user)
        team = self.create_team(organization=self.organization, slug="test-team")
        self.project.add_team(team)

        detector1 = self.create_detector(
            project=self.project,
            name="Detector 1",
            type=MetricIssue.slug,
            owner_user_id=user.id,
        )
        detector2 = self.create_detector(
            project=self.project,
            name="Detector 2",
            type=MetricIssue.slug,
            owner_team_id=team.id,
        )
        self.create_detector(
            project=self.project,
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
            project=self.project,
            name="Excluded Detector",
            type=MetricIssue.slug,
            owner_user_id=user.id,
        )
        included_detector = self.create_detector(
            project=self.project,
            name="Included Detector",
            type=MetricIssue.slug,
        )

        response = self.get_success_response(
            self.organization.slug,
            qs_params={"project": self.project.id, "query": f"!assignee:{user.email}"},
        )
        assert {d["name"] for d in response.data} == {
            included_detector.name,
            self.error_detector.name,
            self.issue_stream_detector.name,
        }

    def test_query_by_assignee_invalid_user(self) -> None:
        self.create_detector(
            project=self.project,
            name="Valid Detector",
            type=MetricIssue.slug,
        )

        # Query with non-existent user should return no results
        response = self.get_success_response(
            self.organization.slug,
            qs_params={"project": self.project.id, "query": "assignee:nonexistent@example.com"},
        )
        assert len(response.data) == 0

    def test_query_by_project_owner_user(self) -> None:
        new_project = self.create_project(organization=self.organization)
        detector = self.create_detector(
            project_id=new_project.id, name="Test Detector", type=MetricIssue.slug
        )

        owner = self.create_user()
        self.create_member(
            user=owner,
            role="owner",
            organization=self.organization,
        )
        self.login_as(user=owner)

        # Verify that the owner can see detectors for projects that they are not a member of
        response = self.get_success_response(
            self.organization.slug,
            qs_params={"project": new_project.id},
            status_code=200,
        )
        assert {d["name"] for d in response.data} == {
            detector.name,
            self.error_detector.name,
            self.issue_stream_detector.name,
        }

    def test_query_by_id_owner_user(self) -> None:
        self.detector = self.create_detector(
            project=self.project,
            name="Detector 1",
            type=MetricIssue.slug,
        )
        self.detector_2 = self.create_detector(
            project=self.project,
            name="Detector 2",
            type=MetricIssue.slug,
        )

        owner = self.create_user()
        self.create_member(
            user=owner,
            role="owner",
            organization=self.organization,
        )
        self.login_as(user=owner)

        # Verify that the owner can see detectors for projects that they are not a member of
        response = self.get_success_response(
            self.organization.slug,
            qs_params=[("id", str(self.detector.id)), ("id", str(self.detector_2.id))],
            status_code=200,
        )
        assert {d["name"] for d in response.data} == {self.detector.name, self.detector_2.name}


@cell_silo_test
@with_feature("organizations:incidents")
class OrganizationDetectorIndexPutTest(OrganizationDetectorIndexBaseTest):
    method = "PUT"

    def setUp(self) -> None:
        super().setUp()
        self.detector = self.create_detector(
            project=self.project, name="Test Detector", type=MetricIssue.slug, enabled=True
        )
        self.detector_two = self.create_detector(
            project=self.project, name="Another Detector", type=MetricIssue.slug, enabled=True
        )
        self.detector_three = self.create_detector(
            project=self.project, name="Third Detector", type=MetricIssue.slug, enabled=True
        )

        self.error_detector = self.create_detector(
            project=self.project,
            name="Error Detector",
            type=ErrorGroupType.slug,
            enabled=True,
            created_by_id=None,
        )

        self.user_detector = self.create_detector(
            project=self.project,
            name="User Created Detector",
            type=MetricIssue.slug,
            enabled=True,
            created_by_id=self.user.id,
        )

        self.member_user = self.create_user()
        self.create_member(
            team_roles=[(self.team, "contributor")],
            user=self.member_user,
            role="member",
            organization=self.organization,
        )

        self.team_admin_user = self.create_user()
        self.create_member(
            team_roles=[(self.team, "admin")],
            user=self.team_admin_user,
            role="member",
            organization=self.organization,
        )

        self.org_manager_user = self.create_user()
        self.create_member(
            user=self.org_manager_user,
            role="manager",
            organization=self.organization,
        )

    def test_update_detectors_by_ids_success(self) -> None:
        response = self.get_success_response(
            self.organization.slug,
            qs_params=[("id", str(self.detector.id)), ("id", str(self.detector_two.id))],
            enabled=False,
            status_code=200,
        )

        # Verify detectors were updated
        self.detector.refresh_from_db()
        self.detector_two.refresh_from_db()
        assert self.detector.enabled is False
        assert self.detector_two.enabled is False

        # Verify third detector was not affected
        self.detector_three.refresh_from_db()
        assert self.detector_three.enabled is True

        # Verify response data
        assert len(response.data) == 2
        detector_ids = {d["id"] for d in response.data}
        assert detector_ids == {str(self.detector.id), str(self.detector_two.id)}
        assert all(d["enabled"] is False for d in response.data)

    def test_update_detectors_by_query_success(self) -> None:
        response = self.get_success_response(
            self.organization.slug,
            qs_params={"query": "test", "project": self.project.id},
            enabled=False,
            status_code=200,
        )

        # Verify detector matching query was updated
        self.detector.refresh_from_db()
        assert self.detector.enabled is False

        # Verify other detectors were not affected
        self.detector_two.refresh_from_db()
        self.detector_three.refresh_from_db()
        assert self.detector_two.enabled is True
        assert self.detector_three.enabled is True

        # Verify response
        assert len(response.data) == 1
        assert response.data[0]["id"] == str(self.detector.id)
        assert response.data[0]["enabled"] is False

    def test_update_detectors_enable_success(self) -> None:
        self.detector.update(enabled=False)
        self.detector_two.update(enabled=False)
        self.detector_three.update(enabled=False)

        response = self.get_success_response(
            self.organization.slug,
            qs_params={"id": str(self.detector_three.id)},
            enabled=True,
            status_code=200,
        )

        # Verify detector was enabled
        self.detector_three.refresh_from_db()
        assert self.detector_three.enabled is True

        # Verify response
        assert len(response.data) == 1
        assert response.data[0]["id"] == str(self.detector_three.id)
        assert response.data[0]["enabled"] is True

    def test_update_detectors_no_parameters_error(self) -> None:
        response = self.get_error_response(
            self.organization.slug,
            enabled=False,
            status_code=400,
        )

        assert "At least one of 'id', 'query', 'project', or 'projectSlug' must be provided" in str(
            response.data["detail"]
        )

    def test_update_detectors_missing_enabled_field(self) -> None:
        response = self.get_error_response(
            self.organization.slug,
            qs_params={"id": str(self.detector.id)},
            status_code=400,
        )

        assert "This field is required." in str(response.data["enabled"])

    def test_update_detectors_invalid_id_format(self) -> None:
        response = self.get_error_response(
            self.organization.slug,
            qs_params={"id": "not-a-number"},
            enabled=False,
            status_code=400,
        )

        assert "id" in response.data
        assert "not a valid integer id" in str(response.data["id"])

    def test_update_detectors_no_matching_detectors(self) -> None:
        response = self.get_error_response(
            self.organization.slug,
            qs_params={"id": "999999"},
            enabled=False,
            status_code=400,
        )

        assert (
            response.data["detail"]
            == "Some detectors were not found or you do not have permission to update them."
        )

    def test_update_detectors_permission_denied_for_member_without_alerts_write(self) -> None:
        self.organization.flags.allow_joinleave = False
        self.organization.update_option("sentry:alerts_member_write", False)
        self.organization.save()

        self.login_as(user=self.member_user)

        self.get_error_response(
            self.organization.slug,
            qs_params={"id": str(self.detector.id)},
            enabled=False,
            status_code=403,
        )

        # Verify detector was not modified
        self.detector.refresh_from_db()
        assert self.detector.enabled is True

    def test_update_detectors_permission_allowed_for_team_admin(self) -> None:
        self.organization.update_option("sentry:alerts_member_write", False)
        self.login_as(user=self.team_admin_user)

        self.get_success_response(
            self.organization.slug,
            qs_params={"id": str(self.detector.id)},
            enabled=False,
            status_code=200,
        )

        # Verify detector was updated
        self.detector.refresh_from_db()
        assert self.detector.enabled is False

    def test_update_detectors_member_permission_allowed_for_user_created_detector(self) -> None:
        self.login_as(user=self.member_user)

        self.get_success_response(
            self.organization.slug,
            qs_params={"id": str(self.user_detector.id)},
            enabled=False,
            status_code=200,
        )

        # Verify detector was updated
        self.user_detector.refresh_from_db()
        assert self.user_detector.enabled is False

    def test_update_detectors_member_permission_denied_for_non_user_created_detector(self) -> None:
        self.login_as(user=self.member_user)

        # Try to update a detector not created by a user
        self.get_error_response(
            self.organization.slug,
            qs_params={"id": str(self.error_detector.id)},
            enabled=False,
            status_code=403,
        )

        # Verify detector was not modified
        self.error_detector.refresh_from_db()
        assert self.error_detector.enabled is True

    def test_update_detectors_org_manager_permission(self) -> None:
        """
        Test that an organization manager can update any type of detector, including error detectors.
        """
        self.login_as(user=self.org_manager_user)

        self.get_success_response(
            self.organization.slug,
            qs_params=[("id", str(self.detector.id)), ("id", str(self.error_detector.id))],
            enabled=False,
            status_code=200,
        )

        self.detector.refresh_from_db()
        self.error_detector.refresh_from_db()
        assert self.detector.enabled is False
        assert self.error_detector.enabled is False

    def test_update_owner_query_by_project(self) -> None:
        new_project = self.create_project(organization=self.organization)
        detector = self.create_detector(
            project=new_project, name="Test Detector", type=MetricIssue.slug, enabled=True
        )

        owner = self.create_user()
        self.create_member(
            user=owner,
            role="owner",
            organization=self.organization,
        )
        self.login_as(user=owner)

        self.get_success_response(
            self.organization.slug,
            qs_params={"project": new_project.id},
            enabled=False,
            status_code=200,
        )

        detector.refresh_from_db()
        assert detector.enabled is False

    def test_update_detectors_mixed_permissions(self) -> None:
        self.login_as(user=self.member_user)

        # Try to update both detectors - should fail because of mixed permissions
        self.get_error_response(
            self.organization.slug,
            qs_params=[("id", str(self.user_detector.id)), ("id", str(self.error_detector.id))],
            enabled=False,
            status_code=403,
        )

        # Verify neither detector was modified
        self.user_detector.refresh_from_db()
        self.error_detector.refresh_from_db()
        assert self.user_detector.enabled is True
        assert self.error_detector.enabled is True


@cell_silo_test
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


@cell_silo_test
class OrganizationDetectorDeleteTest(OrganizationDetectorIndexBaseTest):
    method = "DELETE"

    def assert_unaffected_detectors(self, detectors: Sequence[Detector]) -> None:
        for detector in detectors:
            detector.refresh_from_db()
            assert Detector.objects.get(id=detector.id).status != ObjectStatus.PENDING_DELETION

    def setUp(self) -> None:
        super().setUp()
        self.detector = self.create_detector(
            project=self.project, name="Test Detector", type=MetricIssue.slug
        )
        self.detector_two = self.create_detector(
            project=self.project, name="Another Detector", type=MetricIssue.slug
        )
        self.detector_three = self.create_detector(
            project=self.project, name="Third Detector", type=MetricIssue.slug
        )

    def test_delete_detectors_by_ids_success(self) -> None:
        """Test successful deletion of detectors by specific IDs"""
        with outbox_runner():
            self.get_success_response(
                self.organization.slug,
                qs_params=[("id", str(self.detector.id)), ("id", str(self.detector_two.id))],
                status_code=204,
            )

        # Ensure the detectors are scheduled for deletion
        self.detector.refresh_from_db()
        self.detector_two.refresh_from_db()
        assert self.detector.status == ObjectStatus.PENDING_DELETION
        assert self.detector_two.status == ObjectStatus.PENDING_DELETION
        assert CellScheduledDeletion.objects.filter(
            model_name="Detector",
            object_id=self.detector.id,
        ).exists()
        assert CellScheduledDeletion.objects.filter(
            model_name="Detector",
            object_id=self.detector_two.id,
        ).exists()

        # Delete the detectors
        with self.tasks():
            run_scheduled_deletions()

        # Ensure detectors are removed
        assert not Detector.objects.filter(id=self.detector.id).exists()
        assert not Detector.objects.filter(id=self.detector_two.id).exists()

        # Verify third detector is unaffected
        self.assert_unaffected_detectors([self.detector_three])

    def test_delete_detectors_by_query_success(self) -> None:
        with outbox_runner():
            self.get_success_response(
                self.organization.slug,
                qs_params={"query": "test", "project": self.project.id},
                status_code=204,
            )

        # Ensure the detector is scheduled for deletion
        self.detector.refresh_from_db()
        assert self.detector.status == ObjectStatus.PENDING_DELETION
        assert CellScheduledDeletion.objects.filter(
            model_name="Detector",
            object_id=self.detector.id,
        ).exists()

        # Delete the detectors
        with self.tasks():
            run_scheduled_deletions()

        # Ensure detector is removed
        assert not Detector.objects.filter(id=self.detector.id).exists()

        # Other detectors should be unaffected
        self.assert_unaffected_detectors([self.detector_two, self.detector_three])

    def test_cannot_delete_system_created_detector(self) -> None:
        self.get_error_response(
            self.organization.slug, qs_params={"project": str(self.project.id)}, status_code=403
        )

        assert self.error_detector.status != ObjectStatus.PENDING_DELETION
        assert not CellScheduledDeletion.objects.filter(
            model_name="Detector", object_id=self.error_detector.id
        ).exists()

    def test_delete_no_matching_detectors(self) -> None:
        # Test deleting detectors with non-existent ID
        response = self.get_error_response(
            self.organization.slug,
            qs_params={"id": "999999"},
            status_code=400,
        )
        assert (
            response.data["detail"]
            == "Some detectors were not found or you do not have permission to delete them."
        )

        # Verify no detectors were affected
        self.assert_unaffected_detectors([self.detector, self.detector_two, self.detector_three])

        # Test deleting detectors with non-matching query
        response = self.get_success_response(
            self.organization.slug,
            qs_params={"query": "nonexistent-detector-name", "project": self.project.id},
            status_code=200,
        )
        assert response.data["detail"] == "No detectors found."

        # Verify no detectors were affected
        self.assert_unaffected_detectors([self.detector, self.detector_two, self.detector_three])

    def test_delete_detectors_invalid_id_format(self) -> None:
        response = self.get_error_response(
            self.organization.slug,
            qs_params={"id": "not-a-number"},
            status_code=400,
        )

        assert "id" in response.data
        assert "not a valid integer id" in str(response.data["id"])

    def test_delete_detectors_filtering_ignored_with_ids(self) -> None:
        # Other project detector
        other_project = self.create_project(organization=self.organization)
        detector_other_project = self.create_detector(
            project_id=other_project.id, name="Other Project Detector", type=MetricIssue.slug
        )

        # Other filters should be ignored when specific IDs are provided
        with outbox_runner():
            self.get_success_response(
                self.organization.slug,
                qs_params={
                    "id": str(self.detector_two.id),
                    "project": str(self.project.id),
                },
                status_code=204,
            )

        # Ensure the detector is scheduled for deletion
        self.detector_two.refresh_from_db()
        assert self.detector_two.status == ObjectStatus.PENDING_DELETION
        assert CellScheduledDeletion.objects.filter(
            model_name="Detector",
            object_id=self.detector_two.id,
        ).exists()

        # Delete the detectors
        with self.tasks():
            run_scheduled_deletions()

        # Ensure detector is removed
        assert not Detector.objects.filter(id=self.detector_two.id).exists()

        # Other detectors should be unaffected
        self.assert_unaffected_detectors(
            [self.detector, self.detector_three, detector_other_project]
        )

    def test_delete_detectors_no_parameters_error(self) -> None:
        response = self.get_error_response(
            self.organization.slug,
            status_code=400,
        )

        assert "At least one of 'id', 'query', 'project', or 'projectSlug' must be provided" in str(
            response.data["detail"]
        )

        # Verify no detectors were affected
        self.assert_unaffected_detectors([self.detector, self.detector_two, self.detector_three])

    def test_delete_detectors_audit_entry(self) -> None:
        with outbox_runner():
            self.get_success_response(
                self.organization.slug,
                qs_params={"id": str(self.detector.id)},
                status_code=204,
            )

        assert_org_audit_log_exists(
            organization=self.organization,
            event=audit_log.get_event_id("DETECTOR_REMOVE"),
            target_object=self.detector.id,
            actor=self.user,
        )

    def test_delete_detectors_permission_denied(self) -> None:
        # Members can not delete detectors for projects they are not part of
        other_detector = self.create_detector(
            project=self.create_project(organization=self.organization, teams=[]),
            created_by_id=self.user.id,
        )

        self.organization.flags.allow_joinleave = False
        self.organization.save()
        member_user = self.create_user()
        self.create_member(
            team_roles=[(self.team, "contributor")],
            user=member_user,
            role="member",
            organization=self.organization,
        )
        self.login_as(user=member_user)

        # Returns a 400 because the user does not have visibility into the other projects
        self.get_error_response(
            self.organization.slug,
            qs_params=[("id", str(self.detector.id)), ("id", str(other_detector.id))],
            status_code=400,
        )

        # Verify detector was not affected
        self.assert_unaffected_detectors([self.detector, other_detector])

    def test_delete_system_created_detector_by_id_prevented(self) -> None:
        # Test that system-created detectors cannot be deleted via bulk delete by ID
        error_detector = self.create_detector(
            project=self.project,
            name="Error Detector",
            type=ErrorGroupType.slug,
        )

        self.get_error_response(
            self.organization.slug,
            qs_params={"id": str(error_detector.id)},
            status_code=403,
        )

        self.assert_unaffected_detectors([error_detector])

    def test_delete_system_and_user_created(self) -> None:
        # Test that permission is denied when request includes system-created detectors
        error_detector = self.create_detector(
            project=self.project,
            name="Error Detector",
            type=ErrorGroupType.slug,
        )

        self.get_error_response(
            self.organization.slug,
            qs_params=[
                ("id", str(self.detector.id)),
                ("id", str(error_detector.id)),
            ],
            status_code=403,
        )

        self.assert_unaffected_detectors([self.detector, error_detector])

    def test_delete_system_and_user_created_with_query_filters(self) -> None:
        # Test that permission is denied when query filter request includes system-created detectors
        error_detector = self.create_detector(
            project=self.project,
            name="Test Error Detector",
            type=ErrorGroupType.slug,
        )

        self.get_error_response(
            self.organization.slug,
            qs_params={"query": "Test", "project": self.project.id},
            status_code=403,
        )

        self.assert_unaffected_detectors([self.detector, error_detector])

    def test_delete_dual_written_detector_cleans_up_alert_rule(self) -> None:
        alert_rule = self.create_alert_rule(
            organization=self.organization,
            projects=[self.project],
        )
        self.create_alert_rule_trigger(alert_rule=alert_rule)
        dual_write_alert_rule(alert_rule)

        detector = AlertRuleDetector.objects.get(alert_rule_id=alert_rule.id).detector
        snuba_query = alert_rule.snuba_query
        subscription = QuerySubscription.objects.get(snuba_query=snuba_query)

        with outbox_runner():
            self.get_success_response(
                self.organization.slug,
                qs_params={"id": str(detector.id)},
                status_code=204,
            )

        with self.tasks():
            run_scheduled_deletions()

        assert not Detector.objects.filter(id=detector.id).exists()
        assert not AlertRule.objects.filter(id=alert_rule.id).exists()
        assert not QuerySubscription.objects.filter(id=subscription.id).exists()
        assert not SnubaQuery.objects.filter(id=snuba_query.id).exists()
