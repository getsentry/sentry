from datetime import timedelta

import pytest
from django.utils import timezone

from sentry import audit_log
from sentry.api.serializers import serialize
from sentry.constants import ObjectStatus
from sentry.deletions.models.scheduleddeletion import RegionScheduledDeletion
from sentry.grouping.grouptype import ErrorGroupType
from sentry.incidents.grouptype import MetricIssue
from sentry.incidents.utils.constants import INCIDENTS_SNUBA_SUBSCRIPTION_TYPE
from sentry.models.auditlogentry import AuditLogEntry
from sentry.silo.base import SiloMode
from sentry.snuba.dataset import Dataset
from sentry.snuba.models import QuerySubscription, SnubaQuery, SnubaQueryEventType
from sentry.snuba.subscriptions import create_snuba_query, create_snuba_subscription
from sentry.testutils.asserts import assert_status_code
from sentry.testutils.cases import APITestCase
from sentry.testutils.outbox import outbox_runner
from sentry.testutils.silo import assume_test_silo_mode, region_silo_test
from sentry.testutils.skips import requires_kafka, requires_snuba
from sentry.workflow_engine.models import (
    DataCondition,
    DataConditionGroup,
    DataSource,
    DataSourceDetector,
    Detector,
)
from sentry.workflow_engine.models.data_condition import Condition
from sentry.workflow_engine.types import DetectorPriorityLevel

pytestmark = [pytest.mark.sentry_metrics, requires_snuba, requires_kafka]


@pytest.mark.snuba_ci
class OrganizationDetectorDetailsBaseTest(APITestCase):
    endpoint = "sentry-api-0-organization-detector-details"

    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)
        self.environment = self.create_environment(
            organization_id=self.organization.id, name="production"
        )
        with self.tasks():
            self.snuba_query = create_snuba_query(
                query_type=SnubaQuery.Type.ERROR,
                dataset=Dataset.Events,
                query="hello",
                aggregate="count()",
                time_window=timedelta(minutes=1),
                resolution=timedelta(minutes=1),
                environment=self.environment,
                event_types=[SnubaQueryEventType.EventType.ERROR],
            )
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
            type=MetricIssue.slug,
            workflow_condition_group=self.data_condition_group,
        )
        self.data_source_detector = self.create_data_source_detector(
            data_source=self.data_source, detector=self.detector
        )
        assert self.detector.data_sources is not None


@region_silo_test
class OrganizationDetectorDetailsGetTest(OrganizationDetectorDetailsBaseTest):
    def test_simple(self):
        response = self.get_success_response(self.organization.slug, self.detector.id)
        assert response.data == serialize(self.detector)

    def test_does_not_exist(self):
        self.get_error_response(self.organization.slug, 3, status_code=404)

    def test_malformed_id(self):
        from django.urls import reverse

        # get_error_response can't generate an invalid URL, so we have to
        # generate a correct one and replace the valid ID with an invalid one.
        good_url = reverse(self.endpoint, args=[self.organization.slug, 7654])
        bad_url = good_url.replace("7654", "not-an-id")
        assert_status_code(self.client.get(bad_url), 404)

    def test_pending_deletion(self):
        detector = self.create_detector()
        detector.status = ObjectStatus.PENDING_DELETION
        detector.save()
        self.get_error_response(self.organization.slug, detector.id, status_code=404)


@region_silo_test
class OrganizationDetectorDetailsPutTest(OrganizationDetectorDetailsBaseTest):
    method = "PUT"

    def setUp(self):
        super().setUp()
        self.valid_data = {
            "id": self.detector.id,
            "projectId": self.project.id,
            "name": "Updated Detector",
            "type": MetricIssue.slug,
            "dateCreated": self.detector.date_added,
            "dateUpdated": timezone.now(),
            "dataSource": {
                "queryType": self.snuba_query.type,
                "dataset": self.snuba_query.dataset,
                "query": "updated query",
                "aggregate": self.snuba_query.aggregate,
                "timeWindow": 300,
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
        assert SnubaQuery.objects.get(id=self.snuba_query.id)

    def assert_detector_updated(self, detector):
        assert detector.name == "Updated Detector"
        assert detector.type == MetricIssue.slug
        assert detector.project_id == self.project.id

    def assert_condition_group_updated(self, condition_group):
        assert condition_group
        assert condition_group.logic_type == DataConditionGroup.Type.ANY
        assert condition_group.organization_id == self.organization.id

    def assert_data_condition_updated(self, condition):
        assert condition.type == Condition.GREATER.value
        assert condition.comparison == 100
        assert condition.condition_result == DetectorPriorityLevel.HIGH

    def assert_snuba_query_updated(self, snuba_query):
        assert snuba_query.query == "updated query"
        assert snuba_query.time_window == 300

    def test_update(self):
        with self.tasks():
            response = self.get_success_response(
                self.organization.slug,
                self.detector.id,
                **self.valid_data,
                status_code=200,
            )

        detector = Detector.objects.get(id=response.data["id"])
        assert response.data == serialize([detector])[0]
        self.assert_detector_updated(detector)

        condition_group = detector.workflow_condition_group
        self.assert_condition_group_updated(condition_group)

        conditions = list(DataCondition.objects.filter(condition_group=condition_group))
        assert len(conditions) == 1
        condition = conditions[0]
        self.assert_data_condition_updated(condition)

        data_source_detector = DataSourceDetector.objects.get(detector=detector)
        data_source = DataSource.objects.get(id=data_source_detector.data_source.id)
        query_subscription = QuerySubscription.objects.get(id=data_source.source_id)
        snuba_query = SnubaQuery.objects.get(id=query_subscription.snuba_query.id)
        self.assert_snuba_query_updated(snuba_query)

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
                self.detector.id,
                **data,
                status_code=400,
            )

    def test_update_owner_to_user(self):
        # Initially no owner
        assert self.detector.owner_user_id is None
        assert self.detector.owner_team_id is None

        data = {
            **self.valid_data,
            "owner": self.user.get_actor_identifier(),
        }

        with self.tasks():
            response = self.get_success_response(
                self.organization.slug,
                self.detector.id,
                **data,
                status_code=200,
            )

        detector = Detector.objects.get(id=response.data["id"])

        # Verify owner is set correctly
        assert detector.owner_user_id == self.user.id
        assert detector.owner_team_id is None
        assert detector.owner is not None
        assert detector.owner.identifier == self.user.get_actor_identifier()

        # Verify serialized response includes owner
        assert response.data["owner"] == self.user.get_actor_identifier()

    def test_update_owner_to_team(self):
        # Set initial user owner
        self.detector.owner_user_id = self.user.id
        self.detector.save()

        # Create a team
        team = self.create_team(organization=self.organization)

        data = {
            **self.valid_data,
            "owner": f"team:{team.id}",
        }

        with self.tasks():
            response = self.get_success_response(
                self.organization.slug,
                self.detector.id,
                **data,
                status_code=200,
            )

        detector = Detector.objects.get(id=response.data["id"])

        # Verify owner changed to team
        assert detector.owner_user_id is None
        assert detector.owner_team_id == team.id
        assert detector.owner is not None
        assert detector.owner.identifier == f"team:{team.id}"

        # Verify serialized response includes team owner
        assert response.data["owner"] == f"team:{team.id}"

    def test_update_clear_owner(self):
        # Set initial owner
        self.detector.owner_user_id = self.user.id
        self.detector.save()

        data = {
            **self.valid_data,
            "owner": None,
        }

        with self.tasks():
            response = self.get_success_response(
                self.organization.slug,
                self.detector.id,
                **data,
                status_code=200,
            )

        detector = Detector.objects.get(id=response.data["id"])

        # Verify owner is cleared
        assert detector.owner_user_id is None
        assert detector.owner_team_id is None
        assert detector.owner is None

        # Verify serialized response shows no owner
        assert response.data["owner"] is None


@region_silo_test
class OrganizationDetectorDetailsDeleteTest(OrganizationDetectorDetailsBaseTest):
    method = "DELETE"

    def test_simple(self):
        with outbox_runner():
            self.get_success_response(self.organization.slug, self.detector.id)

        assert RegionScheduledDeletion.objects.filter(
            model_name="Detector", object_id=self.detector.id
        ).exists()
        with assume_test_silo_mode(SiloMode.CONTROL):
            assert AuditLogEntry.objects.filter(
                target_object=self.detector.id,
                event=audit_log.get_event_id("DETECTOR_REMOVE"),
                actor=self.user,
            ).exists()
        self.detector.refresh_from_db()
        assert self.detector.status == ObjectStatus.PENDING_DELETION

    def test_error_group_type(self):
        """
        Test that we do not delete the required error detector
        """
        data_condition_group = self.create_data_condition_group()
        error_detector = self.create_detector(
            project_id=self.project.id,
            name="Error Monitor",
            type=ErrorGroupType.slug,
            workflow_condition_group=data_condition_group,
        )
        with outbox_runner():
            self.get_error_response(self.organization.slug, error_detector.id, status_code=403)

        assert not RegionScheduledDeletion.objects.filter(
            model_name="Detector", object_id=error_detector.id
        ).exists()
        with assume_test_silo_mode(SiloMode.CONTROL):
            assert not AuditLogEntry.objects.filter(
                target_object=error_detector.id,
                event=audit_log.get_event_id("DETECTOR_REMOVE"),
                actor=self.user,
            ).exists()
