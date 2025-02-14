import pytest
from django.utils import timezone

from sentry.api.serializers import serialize
from sentry.deletions.models.scheduleddeletion import RegionScheduledDeletion
from sentry.grouping.grouptype import ErrorGroupType
from sentry.incidents.grouptype import MetricAlertFire
from sentry.incidents.utils.constants import INCIDENTS_SNUBA_SUBSCRIPTION_TYPE
from sentry.snuba.dataset import Dataset
from sentry.snuba.models import SnubaQuery
from sentry.snuba.subscriptions import create_snuba_subscription
from sentry.testutils.cases import APITestCase
from sentry.testutils.outbox import outbox_runner
from sentry.testutils.silo import region_silo_test
from sentry.testutils.skips import requires_snuba
from sentry.workflow_engine.models import (
    DataCondition,
    DataConditionGroup,
    DataSource,
    DataSourceDetector,
    Detector,
)
from sentry.workflow_engine.models.data_condition import Condition
from sentry.workflow_engine.types import DetectorPriorityLevel

pytestmark = requires_snuba


@pytest.mark.snuba_ci
class ProjectDetectorDetailsBaseTest(APITestCase):
    endpoint = "sentry-api-0-project-detector-details"

    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)
        self.environment = self.create_environment(
            organization_id=self.organization.id, name="production"
        )
        self.snuba_query = SnubaQuery.objects.create(
            type=SnubaQuery.Type.ERROR.value,
            dataset=Dataset.Events.value,
            query="hello",
            aggregate="count()",
            time_window=60,
            resolution=60,
            environment=self.environment,
        )
        with self.tasks():
            self.query_subscription = create_snuba_subscription(
                project=self.project,
                subscription_type=INCIDENTS_SNUBA_SUBSCRIPTION_TYPE,
                snuba_query=self.snuba_query,
            )
        self.data_source = self.create_data_source(
            organization=self.organization, source_id=self.query_subscription.id
        )
        self.data_condition_group = self.create_data_condition_group(
            organization_id=self.organization.id,
            logic_type=DataConditionGroup.Type.ANY,
        )
        self.condition = self.create_data_condition(
            condition_group=self.data_condition_group,
            type=Condition.LESS,
            comparison=50,
            condition_result=DetectorPriorityLevel.LOW,
        )
        self.detector = self.create_detector(
            project_id=self.project.id,
            name="Test Detector",
            type=MetricAlertFire.slug,
            workflow_condition_group=self.data_condition_group,
        )
        self.data_source_detector = self.create_data_source_detector(
            data_source=self.data_source, detector=self.detector
        )
        assert self.detector.data_sources is not None


@region_silo_test
class ProjectDetectorDetailsGetTest(ProjectDetectorDetailsBaseTest):
    def test_simple(self):
        response = self.get_success_response(
            self.organization.slug, self.project.slug, self.detector.id
        )
        assert response.data == serialize(self.detector)

    def test_does_not_exist(self):
        self.get_error_response(self.organization.slug, self.project.slug, 3, status_code=404)


@region_silo_test
class ProjectDetectorIndexDeleteTest(ProjectDetectorDetailsBaseTest):
    method = "DELETE"

    def test_simple(self):
        with outbox_runner():
            self.get_success_response(self.organization.slug, self.project.slug, self.detector.id)

        assert RegionScheduledDeletion.objects.filter(
            model_name="Detector", object_id=self.detector.id
        ).exists()

    def test_error_group_type(self):
        """
        Test that we do not delete the required error detector
        """
        data_condition_group = self.create_data_condition_group()
        error_detector = self.create_detector(
            project_id=self.project.id,
            name="Error Detector",
            type=ErrorGroupType.slug,
            workflow_condition_group=data_condition_group,
        )
        with outbox_runner():
            self.get_error_response(
                self.organization.slug, self.project.slug, error_detector.id, status_code=403
            )

        assert not RegionScheduledDeletion.objects.filter(
            model_name="Detector", object_id=error_detector.id
        ).exists()


@region_silo_test
class ProjectDetectorDetailsPutTest(ProjectDetectorDetailsBaseTest):
    method = "PUT"

    def setUp(self):
        super().setUp()
        self.valid_data = {
            "id": self.detector.id,
            "projectId": self.project.id,
            "name": "Updated Detector",
            "detectorType": MetricAlertFire.slug,
            "dateCreated": self.detector.date_added,
            "dateUpdated": timezone.now(),
            "dataSource": {
                "queryType": self.snuba_query.type,
                "dataset": self.snuba_query.dataset,
                "query": "updated query",
                "aggregate": self.snuba_query.aggregate,
                "timeWindow": 5,  # minutes
                "environment": self.environment.name,
                "eventTypes": [event_type.name for event_type in self.snuba_query.event_types],
            },
            "conditionGroup": {
                "id": self.data_condition_group.id,
                "organizationId": self.organization.id,
                "logicType": self.data_condition_group.logic_type,
                "conditions": [
                    {
                        "id": self.condition.id,
                        "comparison": 100,
                        "type": Condition.GREATER,
                        "conditionResult": DetectorPriorityLevel.HIGH,
                        "conditionGroupId": self.condition.condition_group.id,
                    },
                ],
            },
            "config": self.detector.config,
        }

    def test_update(self):
        with self.tasks():
            response = self.get_success_response(
                self.organization.slug,
                self.project.slug,
                self.detector.id,
                **self.valid_data,
                status_code=200,
            )

        detector = Detector.objects.get(id=response.data["id"])
        assert response.data == serialize([detector])[0]
        assert detector.name == "Updated Detector"
        assert detector.type == MetricAlertFire.slug
        assert detector.project_id == self.project.id

        condition_group = detector.workflow_condition_group
        assert condition_group
        assert condition_group.logic_type == DataConditionGroup.Type.ANY
        assert condition_group.organization_id == self.organization.id

        conditions = list(DataCondition.objects.filter(condition_group=condition_group))
        assert len(conditions) == 1
        condition = conditions[0]
        assert condition.type == Condition.GREATER.value
        assert condition.comparison == 100
        assert condition.condition_result == DetectorPriorityLevel.HIGH

        data_source_detector = DataSourceDetector.objects.get(detector=detector)
        data_source = DataSource.objects.get(id=data_source_detector.data_source.id)
        snuba_query = SnubaQuery.objects.get(id=data_source.source_id)
        assert snuba_query.query == "updated query"
        assert snuba_query.time_window == 300  # seconds = 5 minutes

    def test_update_add_data_condition(self):
        """
        Test that we can add an additional data condition
        """
        data = {**self.valid_data}
        condition_group_data = {
            "comparison": 50,
            "type": Condition.GREATER,
            "conditionResult": DetectorPriorityLevel.MEDIUM,
            "conditionGroupId": self.condition.condition_group.id,
        }
        data["conditionGroup"]["conditions"].append(condition_group_data)
        with self.tasks():
            response = self.get_success_response(
                self.organization.slug,
                self.project.slug,
                self.detector.id,
                **data,
                status_code=200,
            )

        detector = Detector.objects.get(id=response.data["id"])
        condition_group = detector.workflow_condition_group
        assert condition_group
        conditions = list(DataCondition.objects.filter(condition_group=condition_group))
        assert len(conditions) == 2

    def test_update_bad_schema(self):
        """
        Test when we encounter bad data in the payload
        """
        data = {**self.valid_data}
        condition_group_data = {
            "comparison": "betterThan",
            "type": Condition.GREATER,
            "conditionResult": DetectorPriorityLevel.MEDIUM,
            "conditionGroupId": self.condition.condition_group.id,
        }
        data["conditionGroup"]["conditions"].append(condition_group_data)
        with self.tasks():
            self.get_error_response(
                self.organization.slug,
                self.project.slug,
                self.detector.id,
                **data,
                status_code=400,
            )
