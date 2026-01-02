from contextlib import AbstractContextManager

import responses

from sentry import audit_log
from sentry.api.serializers import serialize
from sentry.constants import ObjectStatus
from sentry.deletions.models.scheduleddeletion import RegionScheduledDeletion
from sentry.deletions.tasks.scheduled import run_scheduled_deletions
from sentry.incidents.grouptype import MetricIssue
from sentry.models.auditlogentry import AuditLogEntry
from sentry.silo.base import SiloMode
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers import TaskRunner
from sentry.testutils.outbox import outbox_runner
from sentry.testutils.silo import assume_test_silo_mode, region_silo_test
from sentry.workflow_engine.endpoints.validators.base.workflow import WorkflowValidator
from sentry.workflow_engine.models import (
    Action,
    Condition,
    DataConditionGroup,
    DataConditionGroupAction,
    Workflow,
    WorkflowDataConditionGroup,
)
from sentry.workflow_engine.models.detector_workflow import DetectorWorkflow
from sentry.workflow_engine.typings.notification_action import (
    ActionTarget,
    ActionType,
    SentryAppIdentifier,
)
from tests.sentry.workflow_engine.test_base import BaseWorkflowTest


class OrganizationWorkflowDetailsBaseTest(APITestCase):
    endpoint = "sentry-api-0-organization-workflow-details"

    def setUp(self) -> None:
        super().setUp()
        self.login_as(user=self.user)


@region_silo_test
class OrganizationWorkflowIndexGetTest(OrganizationWorkflowDetailsBaseTest):
    def test_simple(self) -> None:
        workflow = self.create_workflow(organization_id=self.organization.id)
        response = self.get_success_response(self.organization.slug, workflow.id)
        assert response.data == serialize(workflow)

    def test_does_not_exist(self) -> None:
        self.get_error_response(self.organization.slug, 3, status_code=404)

    def test_pending_deletion(self) -> None:
        workflow = self.create_workflow(organization_id=self.organization.id)
        workflow.status = ObjectStatus.PENDING_DELETION
        workflow.save()
        self.get_error_response(self.organization.slug, workflow.id, status_code=404)


@region_silo_test
class OrganizationUpdateWorkflowTest(OrganizationWorkflowDetailsBaseTest, BaseWorkflowTest):
    method = "PUT"

    def setUp(self) -> None:
        super().setUp()
        self.valid_workflow = {
            "name": "Test Workflow",
            "enabled": True,
            "config": {},
            "triggers": {"logicType": "any", "conditions": []},
            "actionFilters": [],
        }
        validator = WorkflowValidator(
            data=self.valid_workflow,
            context={"organization": self.organization, "request": self.make_request()},
        )
        validator.is_valid(raise_exception=True)
        self.workflow = validator.create(validator.validated_data)

        self.sentry_app, self.sentry_app_installation = self.create_sentry_app_with_schema()
        self.sentry_app_settings = [
            {"name": "alert_prefix", "value": "[Not Good]"},
            {"name": "channel", "value": "#ignored-errors"},
            {"name": "best_emoji", "value": ":fire:"},
            {"name": "teamId", "value": "1"},
            {"name": "assigneeId", "value": "3"},
        ]

    def test_simple(self) -> None:
        self.valid_workflow["name"] = "Updated Workflow"
        response = self.get_success_response(
            self.organization.slug, self.workflow.id, raw_data=self.valid_workflow
        )
        updated_workflow = Workflow.objects.get(id=response.data.get("id"))

        assert response.status_code == 200
        assert updated_workflow.name == "Updated Workflow"

    @responses.activate
    def test_update_add_sentry_app_action(self) -> None:
        """
        Test that adding a sentry app action to a workflow works as expected
        """
        responses.add(
            method=responses.POST,
            url="https://example.com/sentry/alert-rule",
            status=200,
        )
        self.valid_workflow["actionFilters"] = [
            {
                "logicType": "any",
                "conditions": [
                    {
                        "type": Condition.EQUAL.value,
                        "comparison": 1,
                        "conditionResult": True,
                    }
                ],
                "actions": [
                    {
                        "config": {
                            "sentryAppIdentifier": SentryAppIdentifier.SENTRY_APP_ID,
                            "targetIdentifier": str(self.sentry_app.id),
                            "targetType": ActionType.SENTRY_APP,
                        },
                        "data": {"settings": self.sentry_app_settings},
                        "type": Action.Type.SENTRY_APP,
                    },
                ],
            }
        ]
        response = self.get_success_response(
            self.organization.slug, self.workflow.id, raw_data=self.valid_workflow
        )
        updated_workflow = Workflow.objects.get(id=response.data.get("id"))
        action_filter = WorkflowDataConditionGroup.objects.get(workflow=updated_workflow)
        dcga = DataConditionGroupAction.objects.get(condition_group=action_filter.condition_group)
        action = dcga.action

        assert response.status_code == 200
        assert action.type == Action.Type.SENTRY_APP
        assert action.config == {
            "sentry_app_identifier": SentryAppIdentifier.SENTRY_APP_ID,
            "target_identifier": str(self.sentry_app.id),
            "target_type": ActionTarget.SENTRY_APP.value,
        }
        assert action.data["settings"] == self.sentry_app_settings

    @responses.activate
    def test_update_add_sentry_app_installation_uuid_action(self) -> None:
        """
        Test that adding a sentry app action to a workflow works as expected when we pass the installation UUID instead of the sentry app id.
        We do not create new actions like this today, but we have data like this in the DB and need to make sure it still works until we can migrate away from it
        to use the sentry app id
        """
        responses.add(
            method=responses.POST,
            url="https://example.com/sentry/alert-rule",
            status=200,
        )
        # update the settings
        updated_sentry_app_settings = [
            {"name": "alert_prefix", "value": "[Very Good]"},
            {"name": "channel", "value": "#pay-attention-to-errors"},
            {"name": "best_emoji", "value": ":ice:"},
            {"name": "teamId", "value": "1"},
            {"name": "assigneeId", "value": "3"},
        ]
        self.valid_workflow["actionFilters"] = [
            {
                "logicType": "any",
                "conditions": [
                    {
                        "type": Condition.EQUAL.value,
                        "comparison": 1,
                        "conditionResult": True,
                    }
                ],
                "actions": [
                    {
                        "config": {
                            "sentryAppIdentifier": SentryAppIdentifier.SENTRY_APP_INSTALLATION_UUID,
                            "targetIdentifier": self.sentry_app_installation.uuid,
                            "targetType": ActionType.SENTRY_APP,
                        },
                        "data": {"settings": updated_sentry_app_settings},
                        "type": Action.Type.SENTRY_APP,
                    },
                ],
            }
        ]
        response = self.get_success_response(
            self.organization.slug, self.workflow.id, raw_data=self.valid_workflow
        )
        updated_workflow = Workflow.objects.get(id=response.data.get("id"))
        action_filter = WorkflowDataConditionGroup.objects.get(workflow=updated_workflow)
        dcga = DataConditionGroupAction.objects.get(condition_group=action_filter.condition_group)
        action = dcga.action

        assert response.status_code == 200
        assert action.type == Action.Type.SENTRY_APP
        assert action.config == {
            "sentry_app_identifier": SentryAppIdentifier.SENTRY_APP_ID,
            "target_identifier": str(self.sentry_app.id),
            "target_type": ActionTarget.SENTRY_APP.value,
        }
        assert action.data["settings"] == updated_sentry_app_settings

    def test_update_triggers_with_empty_conditions(self) -> None:
        """Test that passing an empty list to triggers.conditions clears all conditions"""
        # Create a workflow with a trigger condition
        workflow_with_conditions = {
            "name": "Workflow with Conditions",
            "enabled": True,
            "config": {},
            "triggers": {
                "logicType": "any",
                "conditions": [
                    {"type": "first_seen_event", "comparison": True, "conditionResult": True},
                ],
            },
            "action_filters": [],
        }

        validator = WorkflowValidator(
            data=workflow_with_conditions,
            context={"organization": self.organization, "request": self.make_request()},
        )
        validator.is_valid(raise_exception=True)
        workflow = validator.create(validator.validated_data)

        # Verify the condition was created
        assert workflow.when_condition_group is not None
        assert workflow.when_condition_group.conditions.count() == 1

        # Now update with empty conditions list
        data = {
            **self.valid_workflow,
            "triggers": {
                "logicType": "any",
                "conditions": [],
            },
        }

        response = self.get_success_response(self.organization.slug, workflow.id, raw_data=data)

        assert response.status_code == 200

        # Verify all conditions were removed
        workflow.refresh_from_db()
        assert workflow.when_condition_group is not None
        assert workflow.when_condition_group.conditions.count() == 0

    def test_update_detectors_add_detector(self) -> None:
        detector1 = self.create_detector(project=self.project)
        detector2 = self.create_detector(project=self.project, type=MetricIssue.slug)

        assert DetectorWorkflow.objects.filter(workflow=self.workflow).count() == 0

        data = {
            **self.valid_workflow,
            "detectorIds": [detector1.id, detector2.id],
        }

        with outbox_runner():
            response = self.get_success_response(
                self.organization.slug,
                self.workflow.id,
                raw_data=data,
            )

        assert response.status_code == 200

        detector_workflows = DetectorWorkflow.objects.filter(workflow=self.workflow)
        assert detector_workflows.count() == 2
        detector_ids = {dw.detector_id for dw in detector_workflows}
        assert detector_ids == {detector1.id, detector2.id}

        with assume_test_silo_mode(SiloMode.CONTROL):
            audit_entries = AuditLogEntry.objects.filter(
                event=audit_log.get_event_id("DETECTOR_WORKFLOW_ADD"),
                actor=self.user,
            )
            assert audit_entries.count() == 2
            assert audit_entries[0].target_object == detector_workflows[0].id
            assert audit_entries[1].target_object == detector_workflows[1].id

    def test_update_detectors_replace_detectors(self) -> None:
        """Test replacing existing detectors with new ones"""
        existing_detector = self.create_detector(project=self.project)
        new_detector = self.create_detector(project=self.project, type=MetricIssue.slug)

        existing_detector_workflow = DetectorWorkflow.objects.create(
            detector=existing_detector, workflow=self.workflow
        )
        assert DetectorWorkflow.objects.filter(workflow=self.workflow).count() == 1

        data = {
            **self.valid_workflow,
            "detectorIds": [new_detector.id],
        }

        with outbox_runner():
            response = self.get_success_response(
                self.organization.slug,
                self.workflow.id,
                raw_data=data,
            )

        assert response.status_code == 200

        # Verify old detector was removed and new one added
        detector_workflows = DetectorWorkflow.objects.filter(workflow=self.workflow)
        assert detector_workflows.count() == 1
        detector_workflow = detector_workflows.first()
        assert detector_workflow is not None
        assert detector_workflow.detector_id == new_detector.id

        # Verify audit log entries for both adding new detector and removing old detector
        with assume_test_silo_mode(SiloMode.CONTROL):
            assert (
                AuditLogEntry.objects.filter(
                    event=audit_log.get_event_id("DETECTOR_WORKFLOW_ADD"),
                    actor=self.user,
                    target_object=detector_workflow.id,
                ).count()
                == 1
            )

            assert (
                AuditLogEntry.objects.filter(
                    event=audit_log.get_event_id("DETECTOR_WORKFLOW_REMOVE"),
                    actor=self.user,
                    target_object=existing_detector_workflow.id,
                ).count()
                == 1
            )

    def test_update_detectors_remove_all_detectors(self) -> None:
        """Test removing all detectors by passing empty list"""
        # Create and connect a detector initially
        detector = self.create_detector(project=self.project)
        detector_workflow = DetectorWorkflow.objects.create(
            detector=detector, workflow=self.workflow
        )
        assert DetectorWorkflow.objects.filter(workflow=self.workflow).count() == 1

        data = {
            **self.valid_workflow,
            "detectorIds": [],
        }

        with outbox_runner():
            response = self.get_success_response(
                self.organization.slug,
                self.workflow.id,
                raw_data=data,
            )

        assert response.status_code == 200

        # Verify all detectors were removed
        assert DetectorWorkflow.objects.filter(workflow=self.workflow).count() == 0

        # Verify audit log entry for removing detector
        with assume_test_silo_mode(SiloMode.CONTROL):
            assert (
                AuditLogEntry.objects.filter(
                    event=audit_log.get_event_id("DETECTOR_WORKFLOW_REMOVE"),
                    actor=self.user,
                    target_object=detector_workflow.id,
                ).count()
                == 1
            )

    def test_update_detectors_invalid_detector_ids(self) -> None:
        """Test validation failure with non-existent detector IDs"""
        data = {
            **self.valid_workflow,
            "detectorIds": [999999],
        }

        response = self.get_error_response(
            self.organization.slug,
            self.workflow.id,
            raw_data=data,
            status_code=400,
        )

        assert "Some detectors do not exist" in str(response.data)

    def test_update_detectors_from_different_organization(self) -> None:
        """Test validation failure when detectors belong to different organization"""
        other_org = self.create_organization()
        other_project = self.create_project(organization=other_org)
        other_detector = self.create_detector(project=other_project)

        data = {
            **self.valid_workflow,
            "detectorIds": [other_detector.id],
        }

        response = self.get_error_response(
            self.organization.slug,
            self.workflow.id,
            raw_data=data,
            status_code=400,
        )

        assert "Some detectors do not exist" in str(response.data)

    def test_update_detectors_transaction_rollback_on_validation_failure(self) -> None:
        """Test that workflow updates are rolled back when detector validation fails"""
        existing_detector = self.create_detector(project=self.project)
        DetectorWorkflow.objects.create(detector=existing_detector, workflow=self.workflow)

        initial_workflow_name = self.workflow.name
        initial_detector_count = DetectorWorkflow.objects.filter(workflow=self.workflow).count()

        data = {
            **self.valid_workflow,
            "name": "Should Not Be Updated",
            "detectorIds": [999999],
        }

        with outbox_runner():
            response = self.get_error_response(
                self.organization.slug,
                self.workflow.id,
                raw_data=data,
                status_code=400,
            )

        self.workflow.refresh_from_db()
        assert self.workflow.name == initial_workflow_name
        assert (
            DetectorWorkflow.objects.filter(workflow=self.workflow).count()
            == initial_detector_count
        )
        assert "Some detectors do not exist" in str(response.data)

        # Verify no detector-related audit entries were created
        with assume_test_silo_mode(SiloMode.CONTROL):
            assert (
                AuditLogEntry.objects.filter(
                    event=audit_log.get_event_id("DETECTOR_WORKFLOW_ADD"),
                    actor=self.user,
                ).count()
                == 0
            )
            assert (
                AuditLogEntry.objects.filter(
                    event=audit_log.get_event_id("DETECTOR_WORKFLOW_REMOVE"),
                    actor=self.user,
                ).count()
                == 0
            )

    def test_update_without_detector_ids(self) -> None:
        """Test that omitting detectorIds doesn't affect existing detector connections"""
        detector = self.create_detector(project=self.project)
        DetectorWorkflow.objects.create(detector=detector, workflow=self.workflow)
        assert DetectorWorkflow.objects.filter(workflow=self.workflow).count() == 1

        data = {
            **self.valid_workflow,
            "name": "Updated Without Detectors",
        }

        with outbox_runner():
            response = self.get_success_response(
                self.organization.slug,
                self.workflow.id,
                raw_data=data,
            )

        assert response.status_code == 200

        self.workflow.refresh_from_db()
        assert self.workflow.name == "Updated Without Detectors"
        assert DetectorWorkflow.objects.filter(workflow=self.workflow).count() == 1

    def test_update_detectors_no_changes(self) -> None:
        """Test that passing the same detector IDs doesn't change anything"""
        detector = self.create_detector(project=self.project)
        DetectorWorkflow.objects.create(detector=detector, workflow=self.workflow)
        assert DetectorWorkflow.objects.filter(workflow=self.workflow).count() == 1

        data = {
            **self.valid_workflow,
            "detectorIds": [detector.id],  # Same detector ID that's already connected
        }

        with outbox_runner():
            response = self.get_success_response(
                self.organization.slug,
                self.workflow.id,
                raw_data=data,
            )

        assert response.status_code == 200
        assert DetectorWorkflow.objects.filter(workflow=self.workflow).count() == 1

        # Verify no detector-related audit entries were created since no changes were made
        with assume_test_silo_mode(SiloMode.CONTROL):
            assert (
                AuditLogEntry.objects.filter(
                    event=audit_log.get_event_id("DETECTOR_WORKFLOW_ADD"),
                    actor=self.user,
                ).count()
                == 0
            )
            assert (
                AuditLogEntry.objects.filter(
                    event=audit_log.get_event_id("DETECTOR_WORKFLOW_REMOVE"),
                    actor=self.user,
                ).count()
                == 0
            )

    def test_update_action_filter_from_different_organization(self) -> None:
        """Test validation failure when action filter belongs to different organization"""
        other_org = self.create_organization()
        other_dcg = DataConditionGroup.objects.create(
            organization=other_org,
            logic_type=DataConditionGroup.Type.ALL,
        )

        data = {
            **self.valid_workflow,
            "actionFilters": [
                {
                    "id": str(other_dcg.id),
                    "logicType": "none",
                    "conditions": [],
                    "actions": [],
                }
            ],
        }

        response = self.get_error_response(
            self.organization.slug,
            self.workflow.id,
            raw_data=data,
            status_code=400,
        )

        assert "does not belong to this workflow" in str(response.data)

        other_dcg.refresh_from_db()
        assert other_dcg.logic_type == DataConditionGroup.Type.ALL

    def test_update_action_from_different_organization(self) -> None:
        """Test validation failure when action belongs to different organization"""
        other_org = self.create_organization()
        other_dcg = DataConditionGroup.objects.create(
            organization=other_org,
            logic_type=DataConditionGroup.Type.ALL,
        )
        other_action = Action.objects.create(
            type=Action.Type.EMAIL,
            config={"target_type": ActionTarget.TEAM, "target_identifier": "1"},
            data={},
        )
        DataConditionGroupAction.objects.create(
            action=other_action,
            condition_group=other_dcg,
        )
        original_config = other_action.config.copy()

        data = {
            **self.valid_workflow,
            "actionFilters": [
                {
                    "logicType": "any",
                    "conditions": [],
                    "actions": [
                        {
                            "id": str(other_action.id),
                            "type": "email",
                            "config": {"targetType": "team", "targetIdentifier": "999"},
                            "data": {},
                        }
                    ],
                }
            ],
        }

        response = self.get_error_response(
            self.organization.slug,
            self.workflow.id,
            raw_data=data,
            status_code=400,
        )

        assert "does not belong to this workflow" in str(response.data)

        other_action.refresh_from_db()
        assert other_action.config == original_config


@region_silo_test
class OrganizationDeleteWorkflowTest(OrganizationWorkflowDetailsBaseTest, BaseWorkflowTest):
    method = "DELETE"

    def tasks(self) -> AbstractContextManager[None]:
        return TaskRunner()

    def setUp(self) -> None:
        super().setUp()
        self.workflow = self.create_workflow(organization_id=self.organization.id)

    def test_simple(self) -> None:
        with outbox_runner():
            self.get_success_response(self.organization.slug, self.workflow.id)

        assert RegionScheduledDeletion.objects.filter(
            model_name="Workflow",
            object_id=self.workflow.id,
        ).exists()
        self.workflow.refresh_from_db()
        assert self.workflow.status == ObjectStatus.PENDING_DELETION

    def test_audit_entry(self) -> None:
        with outbox_runner():
            self.get_success_response(self.organization.slug, self.workflow.id)

        with assume_test_silo_mode(SiloMode.CONTROL):
            assert AuditLogEntry.objects.filter(
                target_object=self.workflow.id,
                event=audit_log.get_event_id("WORKFLOW_REMOVE"),
                actor=self.user,
            ).exists()

    def test_does_not_exist(self) -> None:
        with outbox_runner():
            response = self.get_error_response(self.organization.slug, 999999999)
            assert response.status_code == 404

        # Ensure it wasn't deleted
        assert not RegionScheduledDeletion.objects.filter(
            model_name="Workflow",
            object_id=self.workflow.id,
        ).exists()

    def test_delete_configured_workflow__action(self) -> None:
        action_condition_group, action = self.create_workflow_action(workflow=self.workflow)

        with outbox_runner():
            self.get_success_response(self.organization.slug, self.workflow.id)

        # Ensure the workflow is scheduled for deletion
        assert RegionScheduledDeletion.objects.filter(
            model_name="Workflow",
            object_id=self.workflow.id,
        ).exists()

        # Delete the workflow
        with self.tasks():
            run_scheduled_deletions()

        # Ensure action is removed
        assert not Action.objects.filter(id=action.id).exists()

    def test_delete_configured_workflow__action_condition(self) -> None:
        action_condition_group, action = self.create_workflow_action(workflow=self.workflow)

        with outbox_runner():
            self.get_success_response(self.organization.slug, self.workflow.id)

        # Ensure the workflow is scheduled for deletion
        assert RegionScheduledDeletion.objects.filter(
            model_name="Workflow",
            object_id=self.workflow.id,
        ).exists()

        # Actually delete the workflow
        with self.tasks():
            run_scheduled_deletions()

        assert not DataConditionGroup.objects.filter(id=action_condition_group.id).exists()

    def test_without_permissions(self) -> None:
        # Create a workflow with a different organization
        new_org = self.create_organization()
        workflow = self.create_workflow(organization_id=new_org.id)

        with outbox_runner():
            response = self.get_error_response(self.organization.slug, workflow.id)
            assert response.status_code == 404
