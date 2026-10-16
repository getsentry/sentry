from __future__ import annotations

import uuid
from unittest import mock

from sentry.db.models import NodeData
from sentry.investigations.alert_action import SeerInvestigationActionHandler
from sentry.investigations.triggers import InvestigationTriggerReferrer
from sentry.services.eventstore.models import GroupEvent
from sentry.testutils.helpers.features import with_feature
from sentry.workflow_engine.endpoints.validators.base import BaseActionValidator
from sentry.workflow_engine.models import Action
from sentry.workflow_engine.registry import action_handler_registry
from sentry.workflow_engine.types import ActionInvocation, WorkflowEventData
from tests.sentry.workflow_engine.test_base import BaseWorkflowTest

FEATURES = ["organizations:investigations", "organizations:investigations-alert-action"]


@mock.patch("sentry.investigations.alert_action.trigger_investigation")
class SeerInvestigationActionHandlerTest(BaseWorkflowTest):
    def setUp(self) -> None:
        super().setUp()
        self.detector = self.create_detector(project=self.project)
        self.workflow = self.create_workflow(created_by_id=self.user.id)
        self.action = self.create_action(
            type=Action.Type.SEER_INVESTIGATION,
            config={"target_type": None, "target_identifier": None},
        )
        self.group = self.create_group(project=self.project)
        self.group_event = GroupEvent(self.project.id, "a" * 32, self.group, NodeData("node-id"))

    def invocation(self, workflow_id: int | None = None) -> ActionInvocation:
        return ActionInvocation(
            event_data=WorkflowEventData(event=self.group_event, group=self.group),
            action=self.action,
            detector=self.detector,
            notification_uuid=str(uuid.uuid4()),
            workflow_id=workflow_id or self.workflow.id,
        )

    def test_is_registered(self, trigger: mock.Mock) -> None:
        assert (
            action_handler_registry.get(Action.Type.SEER_INVESTIGATION)
            is SeerInvestigationActionHandler
        )

    @with_feature(FEATURES)
    def test_triggers_an_investigation_as_the_workflow_creator(self, trigger: mock.Mock) -> None:
        SeerInvestigationActionHandler.execute(self.invocation())

        trigger.assert_called_once_with(
            group=self.group,
            user_id=self.user.id,
            referrer=InvestigationTriggerReferrer.ALERT_ACTION,
            event_id=self.group_event.event_id,
        )

    @with_feature("organizations:investigations")
    def test_does_nothing_without_the_alert_action_feature(self, trigger: mock.Mock) -> None:
        SeerInvestigationActionHandler.execute(self.invocation())

        trigger.assert_not_called()

    @with_feature(FEATURES)
    def test_does_nothing_without_a_workflow_creator(self, trigger: mock.Mock) -> None:
        workflow = self.create_workflow(created_by_id=None)

        SeerInvestigationActionHandler.execute(self.invocation(workflow.id))

        trigger.assert_not_called()

    @with_feature(FEATURES)
    def test_does_nothing_when_the_creator_left_the_organization(self, trigger: mock.Mock) -> None:
        former_member = self.create_user()
        workflow = self.create_workflow(created_by_id=former_member.id)

        SeerInvestigationActionHandler.execute(self.invocation(workflow.id))

        trigger.assert_not_called()

    @with_feature(FEATURES)
    def test_does_nothing_without_open_membership(self, trigger: mock.Mock) -> None:
        self.organization.flags.allow_joinleave = False
        self.organization.save()

        SeerInvestigationActionHandler.execute(self.invocation())

        trigger.assert_not_called()


class SeerInvestigationActionValidationTest(BaseWorkflowTest):
    def validator(self) -> BaseActionValidator:
        return BaseActionValidator(
            data={
                "type": Action.Type.SEER_INVESTIGATION,
                "config": {"targetType": None, "targetIdentifier": "", "targetDisplay": None},
                "data": {},
            },
            context={"organization": self.organization},
        )

    def test_rejects_creation_without_features(self) -> None:
        with self.feature("organizations:investigations"):
            validator = self.validator()
            assert validator.is_valid() is False
            assert "type" in validator.errors

    @with_feature(FEATURES)
    def test_allows_creation_with_features(self) -> None:
        validator = self.validator()
        assert validator.is_valid() is True, validator.errors
