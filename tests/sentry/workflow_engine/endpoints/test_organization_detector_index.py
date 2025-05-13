from sentry.api.serializers import serialize
from sentry.grouping.grouptype import ErrorGroupType
from sentry.incidents.grouptype import MetricIssue
from sentry.models.environment import Environment
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import region_silo_test
from sentry.workflow_engine.models import DataConditionGroup


class OrganizationDetectorIndexBaseTest(APITestCase):
    endpoint = "sentry-api-0-organization-detector-index"

    def setUp(self):
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
    def test_simple(self):
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

    def test_empty_result(self):
        response = self.get_success_response(
            self.organization.slug, qs_params={"project": self.project.id}
        )
        assert len(response.data) == 0

    def test_project_unspecified(self):
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

    def test_invalid_project(self):
        self.create_detector(project=self.project, name="A Test Detector", type=MetricIssue.slug)

        # project might exist, but you're not allowed to know that.
        self.get_error_response(
            self.organization.slug,
            qs_params={"project": 512345},
            status_code=403,
        )

    def test_invalid_sort_by(self):
        response = self.get_error_response(
            self.organization.slug,
            qs_params={"project": self.project.id, "sortBy": "general_malaise"},
        )
        assert "sortBy" in response.data

    def test_sort_by_name(self):
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

    def test_sort_by_connected_workflows(self):
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

    def test_query_by_name(self):
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

    def test_query_by_type(self):
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
            qs_params={"project": self.project.id, "query": "type:error type:metric_issue"},
        )
        assert {d["name"] for d in response2.data} == {detector.name, detector2.name}

    def test_general_query(self):
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
