from collections.abc import Callable
from datetime import UTC, datetime, timedelta
from typing import Any
from unittest import mock
from uuid import uuid4

from django.core.exceptions import ValidationError

from sentry.backup.scopes import RelocationScope
from sentry.db.models import Model
from sentry.incidents.grouptype import MetricIssue
from sentry.incidents.utils.constants import INCIDENTS_SNUBA_SUBSCRIPTION_TYPE
from sentry.incidents.utils.types import ProcessedSubscriptionUpdate
from sentry.integrations.services.integration.service import integration_service
from sentry.issues.issue_occurrence import IssueOccurrence
from sentry.models.group import Group
from sentry.models.project import Project
from sentry.notifications.notification_action.types import BaseActionValidatorHandler
from sentry.sentry_apps.models.sentry_app import SentryApp
from sentry.sentry_apps.models.sentry_app_installation import SentryAppInstallation
from sentry.services.eventstore.models import Event, GroupEvent
from sentry.snuba.dataset import Dataset
from sentry.snuba.models import QuerySubscription, SnubaQuery, SnubaQueryEventType
from sentry.snuba.subscriptions import create_snuba_query, create_snuba_subscription
from sentry.testutils.cases import TestCase
from sentry.testutils.factories import EventType, Factories
from sentry.utils.registry import AlreadyRegisteredError
from sentry.workflow_engine.models import (
    Action,
    DataConditionGroup,
    DataPacket,
    DataSource,
    Detector,
    DetectorWorkflow,
    Workflow,
)
from sentry.workflow_engine.models.data_condition import Condition
from sentry.workflow_engine.registry import data_source_type_registry
from sentry.workflow_engine.types import (
    ActionHandler,
    ConfigTransformer,
    DataConditionHandler,
    DataConditionResult,
    DetectorPriorityLevel,
)
from tests.sentry.issues.test_utils import OccurrenceTestMixin

try:
    type_mock = mock.Mock()
    data_source_type_registry.register("test")(type_mock)
except AlreadyRegisteredError:
    # Ensure "test" is mocked for tests, but don't fail if already registered here.
    pass


class MockModel(Model):
    __relocation_scope__ = RelocationScope.Excluded

    class Meta:
        app_label = "fixtures"


class MockActionHandler(ActionHandler):
    config_schema = {
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "description": "The configuration schema for a Action Configuration",
        "type": "object",
        "properties": {
            "foo": {
                "type": ["string"],
            },
        },
        "required": ["foo"],
        "additionalProperties": False,
    }

    data_schema = {
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "description": "The configuration schema for a Action Data",
        "type": "object",
        "properties": {
            "baz": {
                "type": ["string"],
            },
        },
        "required": ["baz"],
        "additionalProperties": False,
    }

    @staticmethod
    def get_config_transformer() -> ConfigTransformer | None:
        return None


class MockActionValidatorTranslator(BaseActionValidatorHandler):
    notify_action_form = None

    def generate_action_form_data(self) -> dict[str, Any]:
        if not (integration_id := self.validated_data.get("integration_id")):
            raise ValidationError("Integration ID is required for mock action")

        integration = integration_service.get_integration(integration_id=integration_id)
        if not integration:
            raise ValidationError(f"Mock integration with id {integration_id} not found")

        return self.validated_data

    def update_action_data(self, cleaned_data: dict[str, Any]) -> dict[str, Any]:
        return self.validated_data


class DataConditionHandlerMixin:
    patches: list = []

    def setup_condition_mocks(
        self,
        evaluate_value: Callable[[int, Any], DataConditionResult],
        module_paths: list[str],
    ):
        """
        Sets up a mock handler for a DataCondition. This method mocks out the registry of the class, and will
        always return the `MockDataConditionHandler` class.

        :param evaluate_value: The method you want to invoke when `evaluate_value` is called on the mock handler.
        :param module_paths: A list of the paths to override for the data_condition_handler registry.
        """

        class MockDataConditionHandler(DataConditionHandler[int]):
            @staticmethod
            def evaluate_value(value: Any, comparison: Any) -> Any:
                return evaluate_value(value, comparison)

        for module_path in module_paths:
            new_patch = mock.patch(
                f"{module_path}.condition_handler_registry.get",
                return_value=MockDataConditionHandler(),
            )
            self.patches.append(new_patch)
            new_patch.start()

        return Factories.create_data_condition(
            type=Condition.LEVEL,  # this will be overridden by the mock, but it cannot be a operator
            comparison=1.0,
            condition_result=DetectorPriorityLevel.HIGH,
        )

    def teardown_condition_mocks(self):
        """
        Removes the mocks / patches for the DataConditionHandler.
        """
        for patch in self.patches:
            patch.stop()
        self.patches = []


class BaseWorkflowTest(TestCase, OccurrenceTestMixin):
    def create_snuba_query(self, **kwargs):
        return SnubaQuery.objects.create(
            type=SnubaQuery.Type.ERROR.value,
            dataset="events",
            aggregate="count()",
            time_window=60,
            resolution=60,
            **kwargs,
        )

    def create_snuba_query_subscription(
        self, project_id: int | None = None, snuba_query_id: int | None = None, **kwargs
    ):
        if snuba_query_id is None:
            snuba_query_id = self.create_snuba_query().id
        if project_id is None:
            project_id = self.project.id
        return QuerySubscription.objects.create(
            project_id=project_id,
            snuba_query_id=snuba_query_id,
            **kwargs,
        )

    def create_event(
        self,
        project_id: int,
        timestamp: datetime,
        fingerprint: str,
        environment=None,
        level="error",
        tags: list[list[str]] | None = None,
    ) -> Event:
        data = {
            "timestamp": timestamp.isoformat(),
            "environment": environment,
            "fingerprint": [fingerprint],
            "level": level,
            "user": {"id": uuid4().hex},
            "exception": {
                "values": [
                    {
                        "type": "IntegrationError",
                        "value": "Identity not found.",
                    }
                ]
            },
        }
        if tags:
            data["tags"] = tags

        return self.store_event(
            data=data,
            project_id=project_id,
            assert_no_errors=False,
            default_event_type=EventType.ERROR,
        )

    def create_detector_and_workflow(
        self,
        name_prefix: str = "test",
        workflow_triggers: DataConditionGroup | None = None,
        detector_type: str = MetricIssue.slug,
        project: Project | None = None,
        **kwargs,
    ) -> tuple[Workflow, Detector, DetectorWorkflow, DataConditionGroup]:
        """
        Create a Workflow, Detector, DetectorWorkflow, and DataConditionGroup for testing.
        These models are configured to work together to test the workflow engine.
        """
        workflow_triggers = workflow_triggers or self.create_data_condition_group()

        if not workflow_triggers.conditions.exists():
            # create a trigger condition for a new event
            self.create_data_condition(
                condition_group=workflow_triggers,
                type=Condition.EVENT_SEEN_COUNT,
                comparison=1,
                condition_result=True,
            )

        workflow = self.create_workflow(
            name=f"{name_prefix}_workflow",
            when_condition_group=workflow_triggers,
            **kwargs,
        )

        detector = self.create_detector(
            name=f"{name_prefix}_detector",
            type=detector_type,
            project=project if project else self.project,
        )

        detector_workflow = self.create_detector_workflow(
            detector=detector,
            workflow=workflow,
        )

        return workflow, detector, detector_workflow, workflow_triggers

    def create_test_query_data_source(
        self, detector: Detector
    ) -> tuple[SnubaQuery, QuerySubscription, DataSource, DataPacket]:
        """
        Create a DataSource and DataPacket for testing; this will create a QuerySubscriptionUpdate and link it to a data_source.

        A detector is required to create this test data, so we can ensure that the detector
        has a condition to evaluate for the data_packet that evalutes to true.
        """
        with self.tasks():
            snuba_query = create_snuba_query(
                query_type=SnubaQuery.Type.ERROR,
                dataset=Dataset.Events,
                query="hello",
                aggregate="count()",
                time_window=timedelta(minutes=1),
                resolution=timedelta(minutes=1),
                environment=self.environment,
                event_types=[SnubaQueryEventType.EventType.ERROR],
            )
            query_subscription = create_snuba_subscription(
                project=detector.project,
                subscription_type=INCIDENTS_SNUBA_SUBSCRIPTION_TYPE,
                snuba_query=snuba_query,
            )

        subscription_update = ProcessedSubscriptionUpdate(
            subscription_id=str(query_subscription.id),
            values={"value": 1},
            timestamp=datetime.now(UTC),
            entity="test-entity",
        )

        data_source = self.create_data_source(
            source_id=str(subscription_update.subscription_id),
            organization=self.organization,
        )

        data_source.detectors.add(detector)

        if detector.workflow_condition_group is None:
            detector.workflow_condition_group = self.create_data_condition_group(logic_type="any")
            detector.save()

            self.create_data_condition(
                condition_group=detector.workflow_condition_group,
                type=Condition.EQUAL,
                condition_result=DetectorPriorityLevel.HIGH,
                comparison=1,
            )

        # Create a data_packet from the update for testing
        data_packet = DataPacket[ProcessedSubscriptionUpdate](
            source_id=str(subscription_update.subscription_id),
            packet=subscription_update,
        )

        return snuba_query, query_subscription, data_source, data_packet

    def create_workflow_action(
        self,
        workflow: Workflow,
        action: Action | None = None,
        **kwargs,
    ) -> tuple[DataConditionGroup, Action]:
        action_group = self.create_data_condition_group(logic_type="any-short")

        action = action or self.create_action(integration_id=self.integration.id)

        self.create_data_condition_group_action(
            condition_group=action_group,
            action=action,
        )

        # Add the action group to the workflow
        self.create_workflow_data_condition_group(workflow, action_group)

        return action_group, action

    def create_group_event(
        self,
        project: Project | None = None,
        event: Event | None = None,
        occurrence: IssueOccurrence | None = None,
        environment: str | None = None,
        fingerprint="test_fingerprint",
        group_type_id: int | None = None,
    ) -> tuple[Group, Event, GroupEvent]:
        project = project or self.project
        event = event or self.create_event(
            project.id,
            datetime.now(),
            fingerprint,
            environment,
        )

        if group_type_id:
            group = self.create_group(project=project, type=group_type_id)
        else:
            group = self.create_group(project=project)

        event.for_group(group)

        group_event = GroupEvent(
            self.project.id,
            event.event_id,
            group,
            event.data,
            event._snuba_data,
            occurrence,
        )

        return group, event, group_event

    def create_sentry_app_with_schema(self) -> tuple[SentryApp, SentryAppInstallation]:
        sentry_app_settings_schema = self.create_alert_rule_action_schema()
        sentry_app = self.create_sentry_app(
            name="Moo Deng's Fire Sentry App",
            organization=self.organization,
            schema={
                "elements": [
                    sentry_app_settings_schema,
                ]
            },
            is_alertable=True,
        )
        installation = self.create_sentry_app_installation(
            slug=sentry_app.slug, organization=self.organization
        )
        return sentry_app, installation
