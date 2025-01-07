from datetime import timedelta

from sentry.api.serializers import serialize
from sentry.incidents.grouptype import MetricAlertFire
from sentry.incidents.utils.constants import INCIDENTS_SNUBA_SUBSCRIPTION_TYPE
from sentry.snuba.dataset import Dataset
from sentry.snuba.models import QuerySubscriptionDataSourceHandler, SnubaQuery
from sentry.snuba.subscriptions import create_snuba_query, create_snuba_subscription
from sentry.testutils.cases import TestCase
from sentry.workflow_engine.models import DataCondition, DataConditionGroup, DataSource, Detector
from sentry.workflow_engine.models.data_condition import Condition
from sentry.workflow_engine.registry import data_source_type_registry
from sentry.workflow_engine.types import DetectorPriorityLevel


class TestDetectorSerializer(TestCase):
    def test_serialize_simple(self):
        detector = Detector.objects.create(
            organization_id=self.organization.id,
            name="Test Detector",
            type=MetricAlertFire.slug,
        )

        result = serialize(detector)

        assert result == {
            "id": str(detector.id),
            "organizationId": str(self.organization.id),
            "name": "Test Detector",
            "type": MetricAlertFire.slug,
            "dateCreated": detector.date_added,
            "dateUpdated": detector.date_updated,
            "dataSources": None,
            "conditionGroup": None,
            "config": {},
        }

    def test_serialize_full(self):
        condition_group = DataConditionGroup.objects.create(
            organization_id=self.organization.id,
            logic_type=DataConditionGroup.Type.ANY,
        )
        condition = DataCondition.objects.create(
            condition_group=condition_group,
            type=Condition.GREATER,
            comparison=100,
            condition_result=DetectorPriorityLevel.HIGH,
        )
        detector = Detector.objects.create(
            organization_id=self.organization.id,
            name="Test Detector",
            type=MetricAlertFire.slug,
            workflow_condition_group=condition_group,
        )
        snuba_query = create_snuba_query(
            SnubaQuery.Type.ERROR,
            Dataset.Events,
            "hello",
            "count()",
            timedelta(minutes=1),
            timedelta(minutes=1),
            None,
        )
        subscription = create_snuba_subscription(
            self.project, INCIDENTS_SNUBA_SUBSCRIPTION_TYPE, snuba_query
        )
        type_name = data_source_type_registry.get_key(QuerySubscriptionDataSourceHandler)
        data_source = DataSource.objects.create(
            organization_id=self.organization.id,
            type=type_name,
            query_id=subscription.id,
        )
        data_source.detectors.set([detector])

        result = serialize(detector)

        assert result == {
            "id": str(detector.id),
            "organizationId": str(self.organization.id),
            "name": "Test Detector",
            "type": MetricAlertFire.slug,
            "dateCreated": detector.date_added,
            "dateUpdated": detector.date_updated,
            "dataSources": [
                {
                    "id": str(data_source.id),
                    "organizationId": str(self.organization.id),
                    "type": type_name,
                    "queryId": str(subscription.id),
                    "queryObj": {
                        "id": str(subscription.id),
                        "snubaQuery": {
                            "aggregate": "count()",
                            "dataset": "events",
                            "environment": None,
                            "id": str(snuba_query.id),
                            "query": "hello",
                            "timeWindow": 60,
                        },
                        "status": 1,
                        "subscription": None,
                    },
                }
            ],
            "conditionGroup": {
                "id": str(condition_group.id),
                "organizationId": str(self.organization.id),
                "logicType": DataConditionGroup.Type.ANY,
                "conditions": [
                    {
                        "id": str(condition.id),
                        "condition": Condition.GREATER,
                        "comparison": 100,
                        "result": DetectorPriorityLevel.HIGH,
                    }
                ],
            },
            "config": {},
        }

    def test_serialize_bulk(self):
        detectors = [
            Detector.objects.create(
                organization_id=self.organization.id,
                name=f"Test Detector {i}",
                type=MetricAlertFire.slug,
            )
            for i in range(2)
        ]

        result = serialize(detectors)

        assert len(result) == 2
        assert all(d["name"] in ["Test Detector 0", "Test Detector 1"] for d in result)


class TestDataSourceSerializer(TestCase):
    def test_serialize(self):
        snuba_query = create_snuba_query(
            SnubaQuery.Type.ERROR,
            Dataset.Events,
            "hello",
            "count()",
            timedelta(minutes=1),
            timedelta(minutes=1),
            None,
        )
        type_name = data_source_type_registry.get_key(QuerySubscriptionDataSourceHandler)
        subscription = create_snuba_subscription(
            self.project, INCIDENTS_SNUBA_SUBSCRIPTION_TYPE, snuba_query
        )
        data_source = DataSource.objects.create(
            organization_id=self.organization.id,
            type=type_name,
            query_id=subscription.id,
        )

        result = serialize(data_source)

        assert result == {
            "id": str(data_source.id),
            "organizationId": str(self.organization.id),
            "type": type_name,
            "queryId": str(subscription.id),
            "queryObj": {
                "id": str(subscription.id),
                "snubaQuery": {
                    "aggregate": "count()",
                    "dataset": "events",
                    "environment": None,
                    "id": str(snuba_query.id),
                    "query": "hello",
                    "timeWindow": 60,
                },
                "status": 1,
                "subscription": None,
            },
        }


class TestDataConditionGroupSerializer(TestCase):
    def test_serialize_simple(self):
        condition_group = DataConditionGroup.objects.create(
            organization_id=self.organization.id,
            logic_type=DataConditionGroup.Type.ANY,
        )

        result = serialize(condition_group)

        assert result == {
            "id": str(condition_group.id),
            "organizationId": str(self.organization.id),
            "logicType": DataConditionGroup.Type.ANY,
            "conditions": [],
        }

    def test_serialize_with_conditions(self):
        condition_group = DataConditionGroup.objects.create(
            organization_id=self.organization.id,
            logic_type=DataConditionGroup.Type.ANY,
        )
        condition = DataCondition.objects.create(
            condition_group=condition_group,
            type=Condition.GREATER,
            comparison=100,
            condition_result=DetectorPriorityLevel.HIGH,
        )

        result = serialize(condition_group)

        assert result == {
            "id": str(condition_group.id),
            "organizationId": str(self.organization.id),
            "logicType": DataConditionGroup.Type.ANY,
            "conditions": [
                {
                    "id": str(condition.id),
                    "condition": "gt",
                    "comparison": 100,
                    "result": DetectorPriorityLevel.HIGH,
                }
            ],
        }


class TestActionSerializer(TestCase):
    pass
