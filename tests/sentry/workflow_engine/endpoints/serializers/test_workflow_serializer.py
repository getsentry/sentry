from datetime import timedelta

from django.db import connections, router
from django.test.utils import CaptureQueriesContext

from sentry.api.serializers import serialize
from sentry.notifications.models.notificationaction import ActionTarget
from sentry.testutils.cases import TestCase
from sentry.testutils.skips import requires_snuba
from sentry.workflow_engine.endpoints.serializers.workflow_serializer import WorkflowSerializer
from sentry.workflow_engine.models import (
    Action,
    DataConditionGroup,
    Workflow,
    WorkflowFireHistory,
)
from sentry.workflow_engine.models.data_condition import Condition
from sentry.workflow_engine.types import DetectorPriorityLevel

pytestmark = [requires_snuba]


class TestWorkflowSerializer(TestCase):
    def test_serialize_simple(self) -> None:
        workflow = self.create_workflow(
            name="hojicha",
            organization_id=self.organization.id,
            config={},
        )

        result = serialize(workflow)

        assert result == {
            "id": str(workflow.id),
            "name": str(workflow.name),
            "type": "alert",
            "organizationId": str(self.organization.id),
            "config": {},
            "createdBy": None,
            "dateCreated": workflow.date_added,
            "dateUpdated": workflow.date_updated,
            "triggers": None,
            "actionFilters": [],
            "environment": None,
            "detectorIds": [],
            "enabled": workflow.enabled,
            "lastTriggered": None,
            "owner": None,
        }

    def test_serialize_full(self) -> None:
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
            created_by_id=self.user.id,
        )

        condition_group = self.create_data_condition_group(
            organization_id=self.organization.id,
            logic_type=DataConditionGroup.Type.ALL,
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

        detector = self.create_detector()
        self.create_detector_workflow(
            detector=detector,
            workflow=workflow,
        )

        history = WorkflowFireHistory.objects.create(
            workflow=workflow,
            group=self.group,
            event_id=self.event.event_id,
        )
        # Too old, shouldn't be used.
        WorkflowFireHistory.objects.create(
            workflow=workflow,
            group=self.group,
            event_id=self.event.event_id,
        )
        history.date_added = workflow.date_added + timedelta(seconds=1)
        history.save()

        result = serialize(workflow)

        assert result == {
            "id": str(workflow.id),
            "name": str(workflow.name),
            "type": "alert",
            "organizationId": str(self.organization.id),
            "config": {},
            "createdBy": str(self.user.id),
            "dateCreated": workflow.date_added,
            "dateUpdated": workflow.date_updated,
            "triggers": {
                "id": str(when_condition_group.id),
                "organizationId": str(self.organization.id),
                "logicType": DataConditionGroup.Type.ANY.value,
                "conditions": [
                    {
                        "id": str(trigger_condition.id),
                        "type": "first_seen_event",
                        "comparison": True,
                        "conditionResult": True,
                    }
                ],
                "actions": [],
            },
            "actionFilters": [
                {
                    "id": str(condition_group.id),
                    "organizationId": str(self.organization.id),
                    "logicType": DataConditionGroup.Type.ALL.value,
                    "conditions": [
                        {
                            "id": str(condition.id),
                            "type": "gt",
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
            ],
            "environment": self.environment.name,
            "detectorIds": [str(detector.id)],
            "enabled": workflow.enabled,
            "lastTriggered": history.date_added,
            "owner": None,
        }

    def test_serialize_bulk_queries_one(self) -> None:
        self._assert_serialize_bulk_queries(1)

    def test_serialize_bulk_queries_three(self) -> None:
        self._assert_serialize_bulk_queries(3)

    def _assert_serialize_bulk_queries(self, workflow_count: int) -> None:
        environments = [
            self.environment,
            self.create_environment(project=self.project, name="staging"),
            None,
        ]
        environment_names = [self.environment.name, "staging", None]
        shared_action = self.create_action(
            type=Action.Type.EMAIL,
            data={},
            config={"target_identifier": "123", "target_type": ActionTarget.USER.value},
        )
        shared_action_data = {
            "id": str(shared_action.id),
            "type": "email",
            "integrationId": None,
            "data": {},
            "config": {"targetType": "user", "targetIdentifier": "123"},
            "status": "active",
        }
        workflows = []
        expected = []
        for index in range(workflow_count):
            trigger = self.create_data_condition_group(organization=self.organization)
            workflow = self.create_workflow(
                organization=self.organization,
                when_condition_group=trigger,
                environment=environments[index % 3],
                owner_user_id=self.user.id,
                config={"frequency": 30},
            )
            workflows.append(workflow)
            filters = []
            for _ in range(2):
                group = self.create_data_condition_group(organization=self.organization)
                self.create_workflow_data_condition_group(workflow=workflow, condition_group=group)
                self.create_data_condition_group_action(condition_group=group, action=shared_action)
                action = self.create_action(
                    type=Action.Type.EMAIL,
                    data={},
                    config={"target_identifier": "456", "target_type": ActionTarget.USER.value},
                )
                self.create_data_condition_group_action(condition_group=group, action=action)
                filters.append(
                    {
                        "id": str(group.id),
                        "organizationId": str(self.organization.id),
                        "logicType": group.logic_type,
                        "conditions": [],
                        "actions": [
                            shared_action_data,
                            {
                                **shared_action_data,
                                "id": str(action.id),
                                "config": {"targetType": "user", "targetIdentifier": "456"},
                            },
                        ],
                    }
                )
            expected.append(
                {
                    "id": str(workflow.id),
                    "name": workflow.name,
                    "type": "alert",
                    "organizationId": str(self.organization.id),
                    "createdBy": None,
                    "dateCreated": workflow.date_added,
                    "dateUpdated": workflow.date_updated,
                    "triggers": {
                        "id": str(trigger.id),
                        "organizationId": str(self.organization.id),
                        "logicType": trigger.logic_type,
                        "conditions": [],
                        "actions": [],
                    },
                    "actionFilters": filters,
                    "environment": environment_names[index % 3],
                    "config": {"frequency": 30},
                    "detectorIds": [],
                    "enabled": True,
                    "lastTriggered": None,
                    "owner": f"user:{self.user.id}",
                }
            )

        # Refetch to avoid the factories' cached forward relations.
        workflows = list(Workflow.objects.filter(id__in=[w.id for w in workflows]).order_by("id"))
        serializer = WorkflowSerializer()
        connection = connections[router.db_for_read(Workflow)]
        with CaptureQueriesContext(connection) as queries:
            attrs = serializer.get_attrs(workflows, self.user)
        assert len(queries) == 9
        environment_queries = [
            query for query in queries if 'FROM "sentry_environment"' in query["sql"]
        ]
        assert len(environment_queries) == 1

        with CaptureQueriesContext(connection) as queries:
            result = [
                serializer.serialize(workflow, attrs[workflow], self.user) for workflow in workflows
            ]
        assert len(queries) == 0
        assert result == expected

    def test_serialize_without_environments_is_database_free(self) -> None:
        workflow = self.create_workflow(organization=self.organization, environment=None)
        workflow = Workflow.objects.get(id=workflow.id)
        serializer = WorkflowSerializer()
        connection = connections[router.db_for_read(Workflow)]
        with CaptureQueriesContext(connection) as queries:
            attrs = serializer.get_attrs([workflow], self.user)
        assert not [query for query in queries if 'FROM "sentry_environment"' in query["sql"]]

        with CaptureQueriesContext(connection) as queries:
            result = serializer.serialize(workflow, attrs[workflow], self.user)
        assert len(queries) == 0
        assert result["environment"] is None
        assert result["triggers"] is None
        assert result["actionFilters"] == []
