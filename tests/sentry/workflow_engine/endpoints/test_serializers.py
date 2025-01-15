from datetime import timedelta

from sentry.api.serializers import serialize
from sentry.incidents.grouptype import MetricAlertFire
from sentry.incidents.utils.constants import INCIDENTS_SNUBA_SUBSCRIPTION_TYPE
from sentry.integrations.models.integration import Integration
from sentry.notifications.models.notificationaction import ActionTarget
from sentry.silo.base import SiloMode
from sentry.snuba.dataset import Dataset
from sentry.snuba.models import QuerySubscriptionDataSourceHandler, SnubaQuery
from sentry.snuba.subscriptions import create_snuba_query, create_snuba_subscription
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import assume_test_silo_mode
from sentry.workflow_engine.models import Action, DataConditionGroup
from sentry.workflow_engine.models.data_condition import Condition
from sentry.workflow_engine.registry import data_source_type_registry
from sentry.workflow_engine.types import DetectorPriorityLevel


class TestDetectorSerializer(TestCase):
    def test_serialize_simple(self):
        detector = self.create_detector(
            organization_id=self.organization.id, name="Test Detector", type=MetricAlertFire.slug
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
        condition_group = self.create_data_condition_group(
            organization_id=self.organization.id,
            logic_type=DataConditionGroup.Type.ANY,
        )
        condition = self.create_data_condition(
            condition_group=condition_group,
            type=Condition.GREATER,
            comparison=100,
            condition_result=DetectorPriorityLevel.HIGH,
        )
        action = self.create_action(type=Action.Type.EMAIL, data={"foo": "bar"})
        self.create_data_condition_group_action(condition_group=condition_group, action=action)
        detector = self.create_detector(
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
        data_source = self.create_data_source(
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
                "actions": [
                    {
                        "id": str(action.id),
                        "type": "email",
                        "data": '{"foo":"bar"}',
                    }
                ],
            },
            "config": {},
        }

    def test_serialize_bulk(self):
        detectors = [
            self.create_detector(
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
        data_source = self.create_data_source(
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
        condition_group = self.create_data_condition_group(
            organization_id=self.organization.id,
            logic_type=DataConditionGroup.Type.ANY,
        )

        result = serialize(condition_group)

        assert result == {
            "id": str(condition_group.id),
            "organizationId": str(self.organization.id),
            "logicType": DataConditionGroup.Type.ANY,
            "conditions": [],
            "actions": [],
        }

    def test_serialize_full(self):
        condition_group = self.create_data_condition_group(
            organization_id=self.organization.id,
            logic_type=DataConditionGroup.Type.ANY,
        )
        condition = self.create_data_condition(
            condition_group=condition_group,
            type=Condition.GREATER,
            comparison=100,
            condition_result=DetectorPriorityLevel.HIGH,
        )

        action = self.create_action(type=Action.Type.EMAIL, data={"foo": "bar"})

        self.create_data_condition_group_action(condition_group=condition_group, action=action)

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
            "actions": [
                {
                    "id": str(action.id),
                    "type": "email",
                    "data": '{"foo":"bar"}',
                }
            ],
        }


class TestActionSerializer(TestCase):
    def test_serialize_simple(self):
        action = self.create_action(
            type=Action.Type.EMAIL,
            data={"foo": "bar"},
        )

        result = serialize(action)

        assert result == {"id": str(action.id), "type": "email", "data": '{"foo":"bar"}'}

    def test_serialize_with_legacy_fields(self):
        """
        Legacy fields should not be serialized.
        """
        with assume_test_silo_mode(SiloMode.CONTROL):
            integration = Integration.objects.create(
                provider="slack", name="example-integration", external_id="123-id", metadata={}
            )
        action = self.create_action(
            type=Action.Type.SLACK,
            data={"foo": "bar"},
            integration_id=integration.id,
            target_display="freddy frog",
            target_type=ActionTarget.USER,
        )

        result = serialize(action)

        assert result == {"id": str(action.id), "type": "slack", "data": '{"foo":"bar"}'}


class TestWorkflowSerializer(TestCase):
    def test_serialize_simple(self):
        workflow = self.create_workflow(
            name="hojicha",
            organization_id=self.organization.id,
            config={},
        )

        result = serialize(workflow)

        assert result == {
            "id": str(workflow.id),
            "organizationId": str(self.organization.id),
            "dateCreated": workflow.date_added,
            "dateUpdated": workflow.date_updated,
            "triggerConditionGroup": None,
            "dataConditionGroups": [],
            "environment": None,
        }

    def test_serialize_full(self):
        when_condition_group = self.create_data_condition_group(
            organization_id=self.organization.id,
            logic_type=DataConditionGroup.Type.ANY,
        )
        trigger_condition = self.create_data_condition(
            condition_group=when_condition_group,
            type=Condition.FIRST_SEEN_EVENT,
            comparison=True,
            condition_result=True,
        )
        workflow = self.create_workflow(
            name="hojicha",
            organization_id=self.organization.id,
            config={},
            when_condition_group=when_condition_group,
            environment=self.environment,
        )

        condition_group = self.create_data_condition_group(
            organization_id=self.organization.id,
            logic_type=DataConditionGroup.Type.ALL,
        )
        action = self.create_action(type=Action.Type.EMAIL, data={"foo": "bar"})
        self.create_data_condition_group_action(condition_group=condition_group, action=action)
        condition = self.create_data_condition(
            condition_group=condition_group,
            type=Condition.GREATER,
            comparison=100,
            condition_result=DetectorPriorityLevel.HIGH,
        )

        self.create_workflow_data_condition_group(
            condition_group=condition_group,
            workflow=workflow,
        )

        result = serialize(workflow)

        assert result == {
            "id": str(workflow.id),
            "organizationId": str(self.organization.id),
            "dateCreated": workflow.date_added,
            "dateUpdated": workflow.date_updated,
            "triggerConditionGroup": {
                "id": str(when_condition_group.id),
                "organizationId": str(self.organization.id),
                "logicType": DataConditionGroup.Type.ANY,
                "conditions": [
                    {
                        "id": str(trigger_condition.id),
                        "condition": "first_seen_event",
                        "comparison": True,
                        "result": True,
                    }
                ],
                "actions": [],
            },
            "dataConditionGroups": [
                {
                    "id": str(condition_group.id),
                    "organizationId": str(self.organization.id),
                    "logicType": DataConditionGroup.Type.ALL,
                    "conditions": [
                        {
                            "id": str(condition.id),
                            "condition": "gt",
                            "comparison": 100,
                            "result": DetectorPriorityLevel.HIGH,
                        }
                    ],
                    "actions": [
                        {
                            "id": str(action.id),
                            "type": "email",
                            "data": '{"foo":"bar"}',
                        }
                    ],
                },
            ],
            "environment": self.environment.name,
        }
