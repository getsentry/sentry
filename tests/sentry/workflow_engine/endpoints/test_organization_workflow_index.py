from collections.abc import Sequence
from typing import Any
from unittest import mock

from sentry import audit_log
from sentry.api.serializers import serialize
from sentry.constants import ObjectStatus
from sentry.deletions.models.scheduleddeletion import RegionScheduledDeletion
from sentry.deletions.tasks.scheduled import run_scheduled_deletions
from sentry.notifications.models.notificationaction import ActionTarget
from sentry.testutils.asserts import assert_org_audit_log_exists
from sentry.testutils.cases import APITestCase
from sentry.testutils.outbox import outbox_runner
from sentry.testutils.silo import region_silo_test
from sentry.workflow_engine.models import (
    Action,
    DetectorWorkflow,
    Workflow,
    WorkflowDataConditionGroup,
    WorkflowFireHistory,
)


class OrganizationWorkflowAPITestCase(APITestCase):
    endpoint = "sentry-api-0-organization-workflow-index"

    def setUp(self) -> None:
        super().setUp()
        self.login_as(user=self.user)


@region_silo_test
class OrganizationWorkflowIndexBaseTest(OrganizationWorkflowAPITestCase):
    def setUp(self) -> None:
        super().setUp()
        self.workflow = self.create_workflow(
            organization_id=self.organization.id, name="Apple Workflow"
        )
        self.workflow_two = self.create_workflow(
            organization_id=self.organization.id, name="Banana Workflow 2"
        )

        self.workflow_three = self.create_workflow(
            organization_id=self.organization.id, name="Green Apple Workflow 3"
        )

        # Only two workflows have fire histories.
        for workflow in [self.workflow, self.workflow_two]:
            WorkflowFireHistory.objects.create(
                workflow=workflow,
                group=self.group,
                event_id=self.event.event_id,
                is_single_written=True,
            )

    def test_simple(self) -> None:
        response = self.get_success_response(self.organization.slug)
        assert response.data == serialize([self.workflow, self.workflow_two, self.workflow_three])

        # Verify X-Hits header is present and correct
        assert "X-Hits" in response
        hits = int(response["X-Hits"])
        assert hits == 3

    def test_empty_result(self) -> None:
        response = self.get_success_response(
            self.organization.slug, qs_params={"query": "aaaaaaaaaaaaa"}
        )
        assert response.data == []

    def test_filter_by_ids(self) -> None:
        response = self.get_success_response(
            self.organization.slug,
            qs_params=[("id", str(self.workflow.id)), ("id", str(self.workflow_two.id))],
        )
        assert len(response.data) == 2
        assert {w["id"] for w in response.data} == {
            str(self.workflow.id),
            str(self.workflow_two.id),
        }

        # Test with non-existent ID
        response = self.get_success_response(
            self.organization.slug,
            qs_params={"id": "999999"},
        )
        assert len(response.data) == 0

        # Test with invalid ID format
        response = self.get_error_response(
            self.organization.slug,
            qs_params={"id": "not-an-id"},
            status_code=400,
        )
        assert response.data == {"id": ["Invalid ID format"]}

    def test_sort_by_name(self) -> None:
        response = self.get_success_response(self.organization.slug, qs_params={"sortBy": "-name"})
        assert [w["name"] for w in response.data] == [
            self.workflow_three.name,
            self.workflow_two.name,
            self.workflow.name,
        ]
        response2 = self.get_success_response(self.organization.slug, qs_params={"sortBy": "name"})
        assert [w["name"] for w in response2.data] == [
            self.workflow.name,
            self.workflow_two.name,
            self.workflow_three.name,
        ]

    def test_sort_by_duplicated_name(self) -> None:
        fresh_org = self.create_organization(name="Fresh Org", owner=self.user)
        self.create_workflow(organization_id=fresh_org.id, name="Name")
        self.create_workflow(organization_id=fresh_org.id, name="Name")
        self.create_workflow(organization_id=fresh_org.id, name="Name")

        response1 = self.get_success_response(fresh_org.slug, qs_params={"sortBy": "name"})
        assert len(response1.data) == 3
        response2 = self.get_success_response(fresh_org.slug, qs_params={"sortBy": "-name"})
        assert [w["id"] for w in response2.data] == list(
            reversed([w["id"] for w in response1.data])
        )

    def test_sort_by_connected_detectors(self) -> None:
        detector = self.create_detector(project=self.project, name="A Test Detector")
        detector_two = self.create_detector(project=self.project, name="B Test Detector 2")

        self.create_detector_workflow(
            workflow=self.workflow,
            detector=detector,
        )
        self.create_detector_workflow(
            workflow=self.workflow,
            detector=detector_two,
        )

        response = self.get_success_response(
            self.organization.slug, qs_params={"sortBy": "connectedDetectors"}
        )
        assert [w["name"] for w in response.data] == [
            self.workflow_two.name,
            self.workflow_three.name,
            self.workflow.name,
        ]

        response2 = self.get_success_response(
            self.organization.slug, qs_params={"sortBy": "-connectedDetectors"}
        )
        assert [w["name"] for w in response2.data] == [
            self.workflow.name,
            self.workflow_three.name,
            self.workflow_two.name,
        ]

    def test_invalid_sort_by(self) -> None:
        response = self.get_error_response(
            self.organization.slug, qs_params={"sortBy": "not_a_valid_sort_by_field"}
        )
        assert "sortBy" in response.data

    FAKE_SLACK_CONFIG = {
        "target_identifier": "1",
        "target_type": ActionTarget.SPECIFIC,
        "target_display": "Bufo Bill",
    }

    FAKE_EMAIL_CONFIG = {
        "target_identifier": "foo@bar.com",
        "target_type": ActionTarget.SPECIFIC,
    }

    def _create_action_for_workflow(
        self, workflow: Workflow, action_type: Action.Type, config: dict[str, Any]
    ) -> Action:
        action = self.create_action(
            type=action_type,
            data={},
            config=config,
        )
        dcg = self.create_data_condition_group(organization=self.organization)
        self.create_data_condition_group_action(condition_group=dcg, action=action)
        self.create_workflow_data_condition_group(condition_group=dcg, workflow=workflow)
        return action

    def test_sort_by_actions(self) -> None:
        # workflow gets 2 actions, workflow_two/workflow_three get none.
        self._create_action_for_workflow(self.workflow, Action.Type.SLACK, self.FAKE_SLACK_CONFIG)
        self._create_action_for_workflow(self.workflow, Action.Type.EMAIL, self.FAKE_EMAIL_CONFIG)

        response = self.get_success_response(
            self.organization.slug, qs_params={"sortBy": "actions"}
        )
        assert [w["name"] for w in response.data] == [
            self.workflow_two.name,
            self.workflow_three.name,
            self.workflow.name,
        ]

        response2 = self.get_success_response(
            self.organization.slug, qs_params={"sortBy": "-actions"}
        )
        assert [w["name"] for w in response2.data][0] == [
            self.workflow.name,
            self.workflow_three.name,
            self.workflow_two.name,
        ][0]

    def test_sort_by_last_triggered(self) -> None:
        # Fresh fire for self.workflow that would impact sorting if not ignored.
        WorkflowFireHistory.objects.create(
            workflow=self.workflow,
            group=self.group,
            event_id=self.event.event_id,
            is_single_written=False,
        )
        response = self.get_success_response(
            self.organization.slug, qs_params={"sortBy": "lastTriggered"}
        )
        # in ascending order, un-triggered is first.
        assert [w["name"] for w in response.data] == [
            self.workflow_three.name,
            self.workflow.name,
            self.workflow_two.name,
        ]

        response2 = self.get_success_response(
            self.organization.slug, qs_params={"sortBy": "-lastTriggered"}
        )
        assert [w["name"] for w in response2.data] == [
            self.workflow_two.name,
            self.workflow.name,
            self.workflow_three.name,
        ]

    def test_query_filter_by_name(self) -> None:
        response = self.get_success_response(self.organization.slug, qs_params={"query": "apple"})
        assert len(response.data) == 2
        assert {self.workflow.name, self.workflow_three.name} == {w["name"] for w in response.data}

        # With tag syntax, exact only.
        assert (
            self.get_success_response(
                self.organization.slug, qs_params={"query": "name:apple"}
            ).data
            == []
        )

        assert (
            self.get_success_response(
                self.organization.slug, qs_params={"query": 'name:"apple workflow"'}
            ).data[0]["name"]
            == self.workflow.name
        )

        # wildcard
        response2 = self.get_success_response(
            self.organization.slug, qs_params={"query": "name:ap*"}
        )
        assert len(response2.data) == 1
        assert response2.data[0]["name"] == self.workflow.name

        # Non-match
        response3 = self.get_success_response(
            self.organization.slug, qs_params={"query": "Chicago"}
        )
        assert len(response3.data) == 0

    def test_filter_by_project(self) -> None:
        self.create_detector_workflow(
            workflow=self.workflow, detector=self.create_detector(project=self.project)
        )
        self.create_detector_workflow(
            workflow=self.workflow_two, detector=self.create_detector(project=self.project)
        )

        other_project = self.create_project(organization=self.organization, name="Other Project")
        self.create_detector_workflow(
            workflow=self.workflow_three, detector=self.create_detector(project=other_project)
        )

        response = self.get_success_response(
            self.organization.slug, qs_params=[("project", self.project.id)]
        )
        assert len(response.data) == 2
        assert {self.workflow.name, self.workflow_two.name} == {w["name"] for w in response.data}

        response2 = self.get_success_response(
            self.organization.slug,
            qs_params=[("project", other_project.id), ("project", self.project.id)],
        )
        assert len(response2.data) == 3
        assert {self.workflow.name, self.workflow_three.name, self.workflow_two.name} == {
            w["name"] for w in response2.data
        }

        # Make sure slugs work too.
        slug_response = self.get_success_response(
            self.organization.slug, qs_params=[("projectSlug", self.project.slug)]
        )
        assert len(slug_response.data) == 2
        assert {self.workflow.name, self.workflow_two.name} == {
            w["name"] for w in slug_response.data
        }

        empty_project = self.create_project(organization=self.organization, name="Empty Project")
        assert not self.get_success_response(
            self.organization.slug, qs_params=[("project", empty_project.id)]
        ).data

    def test_query_filter_by_action(self) -> None:
        self._create_action_for_workflow(self.workflow, Action.Type.SLACK, self.FAKE_SLACK_CONFIG)
        self._create_action_for_workflow(self.workflow, Action.Type.SLACK, self.FAKE_SLACK_CONFIG)
        self._create_action_for_workflow(
            self.workflow_two, Action.Type.EMAIL, self.FAKE_EMAIL_CONFIG
        )

        # Two actions should match, but they are from the same workflow so we only expect
        # one result.
        response = self.get_success_response(
            self.organization.slug, qs_params={"query": "action:slack"}
        )
        assert len(response.data) == 1
        assert response.data[0]["name"] == self.workflow.name

        # No partial matches with tags.
        assert (
            self.get_success_response(
                self.organization.slug, qs_params={"query": "action:sla"}
            ).data
            == []
        )

        assert (
            self.get_success_response(self.organization.slug, qs_params={"query": "Slack"}).data[0][
                "name"
            ]
            == self.workflow.name
        )

        response2 = self.get_success_response(
            self.organization.slug, qs_params={"query": "action:discord"}
        )
        assert len(response2.data) == 0

        response3 = self.get_success_response(
            self.organization.slug, qs_params={"query": "action:[slack,email]"}
        )
        assert len(response3.data) == 2
        assert {self.workflow.name, self.workflow_two.name} == {w["name"] for w in response3.data}

    def test_sort_by_last_triggered_with_non_single_written_only(self) -> None:
        workflow_never_fired = self.create_workflow(
            organization_id=self.organization.id, name="Never Fired"
        )

        workflow_non_single_written_only = self.create_workflow(
            organization_id=self.organization.id, name="Non Single Written Only"
        )
        WorkflowFireHistory.objects.create(
            workflow=workflow_non_single_written_only,
            group=self.group,
            event_id=self.event.event_id,
            is_single_written=False,
        )

        # Test ascending order (lastTriggered)
        response = self.get_success_response(
            self.organization.slug, qs_params={"sortBy": "lastTriggered"}
        )

        # Workflows without single-written history should come first, then those with it
        expected_ascending_order = [
            self.workflow_three.name,
            workflow_never_fired.name,
            workflow_non_single_written_only.name,
            self.workflow.name,
            self.workflow_two.name,
        ]

        assert [w["name"] for w in response.data] == expected_ascending_order

        # Test descending order (-lastTriggered)
        response_desc = self.get_success_response(
            self.organization.slug, qs_params={"sortBy": "-lastTriggered"}
        )

        # In descending order, workflows with single-written history should come first
        expected_descending_order = [
            self.workflow_two.name,
            self.workflow.name,
            workflow_non_single_written_only.name,
            workflow_never_fired.name,
            self.workflow_three.name,
        ]

        assert [w["name"] for w in response_desc.data] == expected_descending_order

    def test_compound_query(self) -> None:
        self.create_detector_workflow(
            workflow=self.workflow, detector=self.create_detector(project=self.project)
        )
        self._create_action_for_workflow(self.workflow, Action.Type.SLACK, self.FAKE_SLACK_CONFIG)

        # Same project, no action.
        self.create_detector_workflow(
            workflow=self.workflow_two, detector=self.create_detector(project=self.project)
        )

        # Different project, same action.
        self.create_detector_workflow(
            workflow=self.workflow_three,
            detector=self.create_detector(project=self.create_project()),
        )
        self._create_action_for_workflow(
            self.workflow_three, Action.Type.SLACK, self.FAKE_SLACK_CONFIG
        )

        response = self.get_success_response(
            self.organization.slug, qs_params={"query": "action:slack", "project": self.project.id}
        )
        assert len(response.data) == 1


@region_silo_test
class OrganizationWorkflowCreateTest(OrganizationWorkflowAPITestCase):
    method = "POST"

    def setUp(self) -> None:
        super().setUp()
        self.valid_workflow = {
            "name": "Test Workflow",
            "enabled": True,
            "config": {},
            "triggers": {"logicType": "any", "conditions": []},
            "actionFilters": [],
        }

    @mock.patch("sentry.workflow_engine.endpoints.validators.base.workflow.create_audit_entry")
    def test_create_workflow__basic(self, mock_audit: mock.MagicMock) -> None:
        response = self.get_success_response(
            self.organization.slug,
            raw_data=self.valid_workflow,
        )

        assert response.status_code == 201
        new_workflow = Workflow.objects.get(id=response.data["id"])
        assert new_workflow.name == self.valid_workflow["name"]

        mock_audit.assert_called_once_with(
            request=mock.ANY,
            organization=self.organization,
            target_object=new_workflow.id,
            event=audit_log.get_event_id("WORKFLOW_ADD"),
            data=new_workflow.get_audit_log_data(),
        )

    def test_create_workflow__with_config(self) -> None:
        self.valid_workflow["config"] = {"frequency": 100}
        response = self.get_success_response(
            self.organization.slug,
            raw_data=self.valid_workflow,
        )

        assert response.status_code == 201
        new_workflow = Workflow.objects.get(id=response.data["id"])
        assert new_workflow.config == self.valid_workflow["config"]

    def test_create_workflow__with_triggers(self) -> None:
        self.valid_workflow["triggers"] = {
            "logicType": "any",
            "conditions": [
                {
                    "type": "eq",
                    "comparison": 1,
                    "conditionResult": True,
                }
            ],
        }

        response = self.get_success_response(
            self.organization.slug,
            raw_data=self.valid_workflow,
        )

        assert response.status_code == 201
        new_workflow = Workflow.objects.get(id=response.data["id"])
        assert new_workflow.when_condition_group is not None
        assert str(new_workflow.when_condition_group.id) == response.data.get("triggers", {}).get(
            "id"
        )

    def test_create_workflow__with_actions(self) -> None:
        self.valid_workflow["actionFilters"] = [
            {
                "logicType": "any",
                "conditions": [
                    {
                        "type": "eq",
                        "comparison": 1,
                        "conditionResult": True,
                    }
                ],
                "actions": [
                    {
                        "type": Action.Type.SLACK,
                        "config": {
                            "targetIdentifier": "test",
                            "targetDisplay": "Test",
                            "targetType": 0,
                        },
                        "data": {},
                        "integrationId": 1,
                    },
                ],
            }
        ]

        response = self.get_success_response(
            self.organization.slug,
            raw_data=self.valid_workflow,
        )

        assert response.status_code == 201
        new_workflow = Workflow.objects.get(id=response.data["id"])
        new_action_filters = WorkflowDataConditionGroup.objects.filter(workflow=new_workflow)
        assert len(new_action_filters) == len(response.data.get("actionFilters", []))
        assert str(new_action_filters[0].condition_group.id) == response.data.get(
            "actionFilters", []
        )[0].get("id")

    def test_create_invalid_workflow(self) -> None:
        self.valid_workflow["name"] = ""
        response = self.get_response(
            self.organization.slug,
            raw_data=self.valid_workflow,
        )

        assert response.status_code == 400

    def test_create_workflow__invalid_triggers(self) -> None:
        self.valid_workflow["triggers"] = {
            "logicType": "some",
            "conditions": [
                {
                    "comparison": 1,
                    "conditionResult": True,
                }
            ],
        }

        response = self.get_response(
            self.organization.slug,
            raw_data=self.valid_workflow,
        )

        assert response.status_code == 400

    def test_create_workflow__invalid_actions(self) -> None:
        self.valid_workflow["actionFilters"] = [
            {
                "logicType": "some",
                "conditions": [
                    {
                        "comparison": 1,
                        "conditionResult": True,
                    }
                ],
                "actions": [
                    {
                        "type": Action.Type.SLACK,
                        "config": {},
                        "data": {},
                    },
                ],
            }
        ]

        response = self.get_response(
            self.organization.slug,
            raw_data=self.valid_workflow,
        )

        assert response.status_code == 400

    @mock.patch("sentry.workflow_engine.endpoints.validators.detector_workflow.create_audit_entry")
    def test_create_workflow_with_detector_ids(self, mock_audit: mock.MagicMock) -> None:
        detector_1 = self.create_detector()
        detector_2 = self.create_detector()

        workflow_data = {
            **self.valid_workflow,
            "detectorIds": [detector_1.id, detector_2.id],
        }

        response = self.get_success_response(
            self.organization.slug,
            raw_data=workflow_data,
        )

        assert response.status_code == 201

        created_detector_workflows = DetectorWorkflow.objects.filter(
            workflow_id=response.data["id"]
        )
        assert created_detector_workflows.count() == 2

        assert mock_audit.call_count == 2
        detector_workflow_audit_calls = [
            call
            for call in mock_audit.call_args_list
            if call.kwargs.get("event") == audit_log.get_event_id("DETECTOR_WORKFLOW_ADD")
        ]
        assert len(detector_workflow_audit_calls) == 2

    def test_create_workflow_with_invalid_detector_ids(self) -> None:
        workflow_data = {
            **self.valid_workflow,
            "detectorIds": [999999],  # doesn't exist
        }

        response = self.get_error_response(
            self.organization.slug,
            raw_data=workflow_data,
            status_code=400,
        )
        assert "detectors do not exist" in str(response.data).lower()

        assert Workflow.objects.count() == 0

    def test_create_workflow_with_unauthorized_detectors(self) -> None:
        self.organization.flags.allow_joinleave = False
        self.organization.save()

        member_user = self.create_user()
        self.create_member(
            team_roles=[(self.team, "contributor")],
            user=member_user,
            role="member",
            organization=self.organization,
        )
        self.login_as(user=member_user)

        detector = self.create_detector()  # owned by self.user, not member_user

        workflow_data = {
            **self.valid_workflow,
            "detectorIds": [detector.id],
        }

        self.get_error_response(
            self.organization.slug,
            raw_data=workflow_data,
            status_code=403,
        )


@region_silo_test
class OrganizationWorkflowPutTest(OrganizationWorkflowAPITestCase):
    method = "PUT"

    def setUp(self) -> None:
        super().setUp()
        self.workflow = self.create_workflow(
            organization_id=self.organization.id, name="Test Workflow", enabled=False
        )
        self.workflow_two = self.create_workflow(
            organization_id=self.organization.id, name="Another Workflow", enabled=False
        )
        self.workflow_three = self.create_workflow(
            organization_id=self.organization.id, name="Third Workflow", enabled=False
        )

    def test_bulk_enable_workflows_by_ids_success(self):
        response = self.get_success_response(
            self.organization.slug,
            qs_params=[("id", str(self.workflow.id)), ("id", str(self.workflow_two.id))],
            raw_data={"enabled": True},
        )

        # Verify workflows were enabled
        self.workflow.refresh_from_db()
        self.workflow_two.refresh_from_db()
        assert self.workflow.enabled is True
        assert self.workflow_two.enabled is True

        # Verify response contains updated workflows
        assert len(response.data) == 2
        workflow_ids = {w["id"] for w in response.data}
        assert workflow_ids == {str(self.workflow.id), str(self.workflow_two.id)}
        assert all(w["enabled"] for w in response.data)

        # Verify third workflow is unaffected
        self.workflow_three.refresh_from_db()
        assert self.workflow_three.enabled is False

    def test_bulk_disable_workflows_by_ids_success(self):
        self.workflow.update(enabled=True)
        self.workflow_two.update(enabled=True)
        self.workflow_three.update(enabled=True)

        response = self.get_success_response(
            self.organization.slug,
            qs_params=[("id", str(self.workflow.id)), ("id", str(self.workflow_two.id))],
            raw_data={"enabled": False},
        )

        # Verify workflows were disabled
        self.workflow.refresh_from_db()
        self.workflow_two.refresh_from_db()
        assert self.workflow.enabled is False
        assert self.workflow_two.enabled is False

        # Verify response contains updated workflows
        assert len(response.data) == 2
        assert all(not w["enabled"] for w in response.data)

        # Verify third workflow is unaffected
        self.workflow_three.refresh_from_db()
        assert self.workflow_three.enabled is True

    def test_bulk_enable_workflows_by_query_success(self):
        response = self.get_success_response(
            self.organization.slug,
            qs_params={"query": "test"},
            raw_data={"enabled": True},
        )

        # Verify workflow was enabled
        self.workflow.refresh_from_db()
        assert self.workflow.enabled is True

        # Verify response contains updated workflow
        assert len(response.data) == 1
        assert response.data[0]["enabled"] is True
        assert response.data[0]["name"] == self.workflow.name

        # Other workflows should be unaffected
        self.workflow_two.refresh_from_db()
        self.workflow_three.refresh_from_db()
        assert self.workflow_two.enabled is False
        assert self.workflow_three.enabled is False

    def test_bulk_update_workflows_no_parameters_error(self):
        """Test error when no filtering parameters are provided"""
        response = self.get_error_response(
            self.organization.slug,
            raw_data={"enabled": True},
            status_code=400,
        )

        assert "At least one of 'id', 'query', 'project', or 'projectSlug' must be provided" in str(
            response.data["detail"]
        )

        # Verify no workflows were affected
        self.workflow.refresh_from_db()
        self.workflow_two.refresh_from_db()
        self.workflow_three.refresh_from_db()
        assert self.workflow.enabled is False
        assert self.workflow_two.enabled is False
        assert self.workflow_three.enabled is False

    def test_bulk_update_workflows_missing_enabled_field_error(self):
        response = self.get_error_response(
            self.organization.slug,
            qs_params={"id": str(self.workflow.id)},
            raw_data={},
            status_code=400,
        )

        assert "This field is required." in str(response.data["enabled"])

        # Verify workflow was not updated
        self.workflow.refresh_from_db()
        assert self.workflow.enabled is False

    def test_bulk_update_no_matching_workflows(self):
        # Test with non-existent ID
        response = self.get_success_response(
            self.organization.slug,
            qs_params={"id": "999999"},
            raw_data={"enabled": True},
            status_code=200,
        )
        assert "No workflows found" in str(response.data["detail"])

        # Test with non-matching query
        response = self.get_success_response(
            self.organization.slug,
            qs_params={"query": "nonexistent-workflow-name"},
            raw_data={"enabled": True},
            status_code=200,
        )
        assert "No workflows found" in str(response.data["detail"])

        # Verify no workflows were affected
        self.workflow.refresh_from_db()
        self.workflow_two.refresh_from_db()
        self.workflow_three.refresh_from_db()
        assert self.workflow.enabled is False
        assert self.workflow_two.enabled is False
        assert self.workflow_three.enabled is False


@region_silo_test
class OrganizationWorkflowDeleteTest(OrganizationWorkflowAPITestCase):
    method = "DELETE"

    def assert_unaffected_workflows(self, workflows: Sequence[Workflow]) -> None:
        for workflow in workflows:
            workflow.refresh_from_db()
            assert Workflow.objects.get(id=workflow.id).status != ObjectStatus.PENDING_DELETION

    def setUp(self) -> None:
        super().setUp()
        self.workflow = self.create_workflow(
            organization_id=self.organization.id, name="Test Workflow"
        )
        self.workflow_two = self.create_workflow(
            organization_id=self.organization.id, name="Another Workflow"
        )
        self.workflow_three = self.create_workflow(
            organization_id=self.organization.id, name="Third Workflow"
        )

    def test_delete_workflows_by_ids_success(self) -> None:
        """Test successful deletion of workflows by specific IDs"""
        with outbox_runner():
            self.get_success_response(
                self.organization.slug,
                qs_params=[("id", str(self.workflow.id)), ("id", str(self.workflow_two.id))],
                status_code=204,
            )

        # Ensure the workflows are scheduled for deletion
        self.workflow.refresh_from_db()
        self.workflow_two.refresh_from_db()
        assert self.workflow.status == ObjectStatus.PENDING_DELETION
        assert self.workflow_two.status == ObjectStatus.PENDING_DELETION
        assert RegionScheduledDeletion.objects.filter(
            model_name="Workflow",
            object_id=self.workflow.id,
        ).exists()
        assert RegionScheduledDeletion.objects.filter(
            model_name="Workflow",
            object_id=self.workflow_two.id,
        ).exists()

        # Delete the workflows
        with self.tasks():
            run_scheduled_deletions()

        # Ensure workflows are removed
        assert not Workflow.objects.filter(id=self.workflow.id).exists()
        assert not Workflow.objects.filter(id=self.workflow_two.id).exists()

        # Verify third workflow is unaffected
        self.assert_unaffected_workflows([self.workflow_three])

    def test_delete_workflows_by_query_success(self) -> None:
        with outbox_runner():
            self.get_success_response(
                self.organization.slug,
                qs_params={"query": "test"},
                status_code=204,
            )

        # Ensure the workflow is scheduled for deletion
        self.workflow.refresh_from_db()
        assert self.workflow.status == ObjectStatus.PENDING_DELETION
        assert RegionScheduledDeletion.objects.filter(
            model_name="Workflow",
            object_id=self.workflow.id,
        ).exists()

        # Delete the workflows
        with self.tasks():
            run_scheduled_deletions()

        # Ensure workflow is removed
        assert not Workflow.objects.filter(id=self.workflow.id).exists()

        # Other workflows should be unaffected
        self.assert_unaffected_workflows([self.workflow_two, self.workflow_three])

    def test_delete_workflows_by_project_success(self) -> None:
        # Create detectors and link workflows to projects
        detector_1 = self.create_detector(project=self.project)
        detector_2 = self.create_detector(project=self.project)
        other_project = self.create_project(organization=self.organization)
        detector_3 = self.create_detector(project=other_project)

        self.create_detector_workflow(workflow=self.workflow, detector=detector_1)
        self.create_detector_workflow(workflow=self.workflow_two, detector=detector_2)
        self.create_detector_workflow(workflow=self.workflow_three, detector=detector_3)

        with outbox_runner():
            self.get_success_response(
                self.organization.slug,
                qs_params={"project": str(self.project.id)},
                status_code=204,
            )

        # Ensure the workflows are scheduled for deletion
        self.workflow.refresh_from_db()
        self.workflow_two.refresh_from_db()
        assert self.workflow.status == ObjectStatus.PENDING_DELETION
        assert self.workflow_two.status == ObjectStatus.PENDING_DELETION
        assert RegionScheduledDeletion.objects.filter(
            model_name="Workflow",
            object_id=self.workflow.id,
        ).exists()
        assert RegionScheduledDeletion.objects.filter(
            model_name="Workflow",
            object_id=self.workflow_two.id,
        ).exists()

        # Delete the workflows
        with self.tasks():
            run_scheduled_deletions()

        # Ensure workflows are removed
        assert not Workflow.objects.filter(id=self.workflow.id).exists()
        assert not Workflow.objects.filter(id=self.workflow_two.id).exists()

        # Workflow linked to other project should be unaffected
        self.assert_unaffected_workflows([self.workflow_three])

    def test_delete_workflows_no_parameters_error(self) -> None:
        response = self.get_error_response(
            self.organization.slug,
            status_code=400,
        )

        assert "At least one of 'id', 'query', 'project', or 'projectSlug' must be provided" in str(
            response.data["detail"]
        )

        # Verify no workflows were affected
        self.assert_unaffected_workflows([self.workflow, self.workflow_two, self.workflow_three])

    def test_delete_no_matching_workflows(self) -> None:
        # Test deleting workflows with non-existent ID
        response = self.get_success_response(
            self.organization.slug,
            qs_params={"id": "999999"},
            status_code=200,
        )
        assert "No workflows found" in str(response.data["detail"])

        # Verify no workflows were affected
        self.assert_unaffected_workflows([self.workflow, self.workflow_two, self.workflow_three])

        # Test deleting workflows with non-matching query
        self.get_success_response(
            self.organization.slug,
            qs_params={"query": "nonexistent-workflow-name"},
            status_code=200,
        )
        assert "No workflows found" in str(response.data["detail"])

        # Verify no workflows were affected
        self.assert_unaffected_workflows([self.workflow, self.workflow_two, self.workflow_three])

    def test_delete_workflows_invalid_id_format(self) -> None:
        response = self.get_error_response(
            self.organization.slug,
            qs_params={"id": "not-a-number"},
            status_code=400,
        )

        assert "Invalid ID format" in str(response.data["id"])

    def test_delete_workflows_filtering_ignored_with_ids(self) -> None:
        # Link workflow to project via detector
        detector = self.create_detector(project=self.project)
        self.create_detector_workflow(workflow=self.workflow, detector=detector)

        # Other filters should be ignored when specific IDs are provided
        with outbox_runner():
            self.get_success_response(
                self.organization.slug,
                qs_params={
                    "id": str(self.workflow_two.id),
                    "project": str(self.project.id),
                },
                status_code=204,
            )

        # Ensure the workflow is scheduled for deletion
        self.workflow_two.refresh_from_db()
        assert self.workflow_two.status == ObjectStatus.PENDING_DELETION
        assert RegionScheduledDeletion.objects.filter(
            model_name="Workflow",
            object_id=self.workflow_two.id,
        ).exists()

        # Delete the workflows
        with self.tasks():
            run_scheduled_deletions()

        # Ensure workflow is removed
        assert not Workflow.objects.filter(id=self.workflow_two.id).exists()

        # Other workflows should be unaffected
        self.assert_unaffected_workflows([self.workflow, self.workflow_three])

    def test_delete_workflows_audit_entry(self) -> None:
        with outbox_runner():
            self.get_success_response(
                self.organization.slug,
                qs_params={"id": str(self.workflow.id)},
                status_code=204,
            )

        assert_org_audit_log_exists(
            organization=self.organization,
            event=audit_log.get_event_id("WORKFLOW_REMOVE"),
            target_object=self.workflow.id,
            actor=self.user,
        )
