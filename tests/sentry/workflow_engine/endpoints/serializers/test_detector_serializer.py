from typing import int
from datetime import timedelta
from unittest import mock

from sentry.api.serializers import serialize
from sentry.incidents.grouptype import MetricIssue
from sentry.incidents.utils.constants import INCIDENTS_SNUBA_SUBSCRIPTION_TYPE
from sentry.models.group import GroupStatus
from sentry.notifications.models.notificationaction import ActionTarget
from sentry.snuba.dataset import Dataset
from sentry.snuba.models import QuerySubscriptionDataSourceHandler, SnubaQuery
from sentry.snuba.subscriptions import create_snuba_query, create_snuba_subscription
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.datetime import before_now
from sentry.testutils.skips import requires_snuba
from sentry.types.group import GroupSubStatus
from sentry.workflow_engine.models import Action, DataConditionGroup
from sentry.workflow_engine.models.data_condition import Condition
from sentry.workflow_engine.models.detector_group import DetectorGroup
from sentry.workflow_engine.registry import data_source_type_registry
from sentry.workflow_engine.types import DetectorPriorityLevel

pytestmark = [requires_snuba]


class TestDetectorSerializer(TestCase):
    def test_serialize_simple(self) -> None:
        detector = self.create_detector(
            project_id=self.project.id, name="Test Detector", type=MetricIssue.slug
        )
        result = serialize(detector)

        assert result == {
            "id": str(detector.id),
            "projectId": str(detector.project_id),
            "name": "Test Detector",
            "description": None,
            "type": MetricIssue.slug,
            "createdBy": None,
            "dateCreated": detector.date_added,
            "dateUpdated": detector.date_updated,
            "dataSources": None,
            "conditionGroup": None,
            "workflowIds": [],
            "config": {
                "thresholdPeriod": 1,
                "detectionType": "static",
            },
            "owner": None,
            "enabled": detector.enabled,
            "alertRuleId": None,
            "ruleId": None,
            "latestGroup": None,
            "openIssues": 0,
        }

    def test_serialize_full(self) -> None:
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
        action = self.create_action(
            type=Action.Type.EMAIL,
            data={},
            config={
                "target_identifier": "123",
                "target_type": ActionTarget.USER.value,
            },
        )
        self.create_data_condition_group_action(condition_group=condition_group, action=action)
        detector = self.create_detector(
            project_id=self.project.id,
            name="Test Detector",
            description="A full featured detector",
            type=MetricIssue.slug,
            workflow_condition_group=condition_group,
            owner_user_id=self.user.id,
            created_by_id=self.user.id,
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
            organization=self.organization,
            type=type_name,
            source_id=str(subscription.id),
        )
        data_source.detectors.set([detector])
        workflow = self.create_workflow(
            organization=self.organization,
        )
        self.create_detector_workflow(detector=detector, workflow=workflow)
        group1 = self.create_group(
            project=self.project, status=GroupStatus.UNRESOLVED, substatus=GroupSubStatus.NEW
        )
        group2 = self.create_group(project=self.project, status=GroupStatus.RESOLVED)
        self.create_detector_group(detector=detector, group=group1)
        self.create_detector_group(detector=detector, group=group2)

        result = serialize(detector)
        assert result == {
            "id": str(detector.id),
            "projectId": str(detector.project_id),
            "name": "Test Detector",
            "description": "A full featured detector",
            "type": MetricIssue.slug,
            "createdBy": str(self.user.id),
            "dateCreated": detector.date_added,
            "dateUpdated": detector.date_updated,
            "dataSources": [
                {
                    "id": str(data_source.id),
                    "organizationId": str(self.organization.id),
                    "type": type_name,
                    "sourceId": str(subscription.id),
                    "queryObj": {
                        "id": str(subscription.id),
                        "snubaQuery": {
                            "aggregate": "count()",
                            "dataset": "events",
                            "environment": None,
                            "id": str(snuba_query.id),
                            "query": "hello",
                            "timeWindow": 60,
                            "eventTypes": ["error"],
                            "extrapolationMode": "unknown",
                        },
                        "status": 1,
                        "subscription": None,
                    },
                }
            ],
            "conditionGroup": {
                "id": str(condition_group.id),
                "organizationId": str(self.organization.id),
                "logicType": DataConditionGroup.Type.ANY.value,
                "conditions": [
                    {
                        "id": str(condition.id),
                        "type": Condition.GREATER.value,
                        "comparison": 100,
                        "conditionResult": DetectorPriorityLevel.HIGH.value,
                    }
                ],
                "actions": [
                    {
                        "id": str(action.id),
                        "type": "email",
                        "data": {},
                        "integrationId": None,
                        "config": {"targetType": "user", "targetIdentifier": "123"},
                        "status": "active",
                    }
                ],
            },
            "workflowIds": [str(workflow.id)],
            "config": {
                "thresholdPeriod": 1,
                "detectionType": "static",
            },
            "owner": {
                "email": self.user.email,
                "id": str(self.user.id),
                "name": self.user.get_username(),
                "type": "user",
            },
            "enabled": detector.enabled,
            "alertRuleId": None,
            "ruleId": None,
            "latestGroup": mock.ANY,
            "openIssues": 1,
        }

    def test_serialize_latest_group(self) -> None:
        detector = self.create_detector(
            project_id=self.project.id, name="Test Detector", type=MetricIssue.slug
        )

        group1 = self.create_group(project=self.project)
        group2 = self.create_group(project=self.project)

        detector_group1 = DetectorGroup.objects.create(detector=detector, group=group1)
        detector_group2 = DetectorGroup.objects.create(detector=detector, group=group2)

        detector_group1.date_added = before_now(seconds=20)
        detector_group2.date_added = before_now(seconds=10)
        detector_group1.save()
        detector_group2.save()

        result = serialize(detector)

        assert result["latestGroup"]["id"] == str(group2.id)

    def test_serialize_bulk(self) -> None:
        detectors = [
            self.create_detector(
                project_id=self.project.id,
                name=f"Test Detector {i}",
                type=MetricIssue.slug,
            )
            for i in range(2)
        ]

        result = serialize(detectors)

        assert len(result) == 2
        assert all(d["name"] in ["Test Detector 0", "Test Detector 1"] for d in result)
