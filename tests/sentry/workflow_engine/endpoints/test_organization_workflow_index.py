from collections.abc import Sequence
from typing import Any
from unittest import mock

import responses

from sentry import audit_log
from sentry.api.serializers import serialize
from sentry.constants import ObjectStatus
from sentry.deletions.models.scheduleddeletion import RegionScheduledDeletion
from sentry.deletions.tasks.scheduled import run_scheduled_deletions
from sentry.grouping.grouptype import ErrorGroupType
from sentry.incidents.grouptype import MetricIssue
from sentry.testutils.asserts import assert_org_audit_log_exists
from sentry.testutils.cases import APITestCase
from sentry.testutils.outbox import outbox_runner
from sentry.testutils.silo import region_silo_test
from sentry.workflow_engine.models import Action, DetectorWorkflow, Workflow, WorkflowFireHistory
from sentry.workflow_engine.models.data_condition import Condition
from sentry.workflow_engine.typings.notification_action import (
    ActionTarget,
    ActionType,
    SentryAppIdentifier,
)
from tests.sentry.workflow_engine.test_base import BaseWorkflowTest, MockActionValidatorTranslator


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
            )

    def test_simple(self) -> None:
        response = self.get_success_response(self.organization.slug)
        assert response.data == serialize([self.workflow, self.workflow_two, self.workflow_three])

        # Verify X-Hits header is present and correct
        assert "X-Hits" in response
        hits = int(response["X-Hits"])
        assert hits == 3

    def test_only_returns_workflows_from_organization(self) -> None:
        other_org = self.create_organization()
        self.create_workflow(organization_id=other_org.id, name="Other Org Workflow")

        response = self.get_success_response(self.organization.slug)
        assert len(response.data) == 3
        workflow_names = {w["name"] for w in response.data}
        assert "Other Org Workflow" not in workflow_names
        assert workflow_names == {
            self.workflow.name,
            self.workflow_two.name,
            self.workflow_three.name,
        }

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
        detector_two = self.create_detector(
            project=self.project, name="B Test Detector 2", type=MetricIssue.slug
        )

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

    def test_sort_by_detector(self) -> None:
        """Test sorting workflows by detector - workflows connected to the specified detector appear first."""
        fresh_org = self.create_organization(name="Fresh Org", owner=self.user)
        fresh_project = self.create_project(organization=fresh_org)

        workflow_a = self.create_workflow(organization_id=fresh_org.id, name="Workflow A")
        workflow_b = self.create_workflow(organization_id=fresh_org.id, name="Workflow B")
        workflow_c = self.create_workflow(organization_id=fresh_org.id, name="Workflow C")

        # Use MetricIssue.slug for different detector types to avoid get_or_create collision
        detector_x = self.create_detector(
            project=fresh_project, name="Detector X", type=MetricIssue.slug
        )
        detector_y = self.create_detector(
            project=fresh_project, name="Detector Y", type=ErrorGroupType.slug
        )

        # workflow_a is connected to detector_x
        self.create_detector_workflow(workflow=workflow_a, detector=detector_x)
        # workflow_b is connected to detector_y
        self.create_detector_workflow(workflow=workflow_b, detector=detector_y)
        # workflow_c has no detector connection

        # Sort by detector_x - workflow_a should come first
        response = self.get_success_response(
            fresh_org.slug, qs_params={"sortBy": f"detector:{detector_x.id}"}
        )
        assert response.data[0]["name"] == workflow_a.name
        assert response.data[1]["name"] == workflow_b.name
        assert response.data[2]["name"] == workflow_c.name

        # Sort by detector_y - workflow_b should come first
        response2 = self.get_success_response(
            fresh_org.slug, qs_params={"sortBy": f"detector:{detector_y.id}"}
        )
        assert response2.data[0]["name"] == workflow_b.name
        assert response2.data[1]["name"] == workflow_a.name
        assert response2.data[2]["name"] == workflow_c.name

        # Descending order - non-priority workflows come first
        response3 = self.get_success_response(
            fresh_org.slug, qs_params={"sortBy": f"-detector:{detector_x.id}"}
        )
        # workflow_a (connected to detector_x) should be last
        assert response3.data[0]["name"] == workflow_c.name
        assert response3.data[1]["name"] == workflow_b.name
        assert response3.data[2]["name"] == workflow_a.name

    def test_sort_by_detector_invalid_format(self) -> None:
        """Test error handling for invalid detector sort format."""
        # Missing detector ID
        response = self.get_error_response(self.organization.slug, qs_params={"sortBy": "detector"})
        assert "sortBy" in response.data

        # Invalid detector ID format
        response2 = self.get_error_response(
            self.organization.slug, qs_params={"sortBy": "detector:not-a-number"}
        )
        assert "sortBy" in response2.data

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
        "target_identifier": None,
        "target_type": ActionTarget.ISSUE_OWNERS,
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

    def test_filter_by_detector(self) -> None:
        project_1 = self.create_project(organization=self.organization)
        project_2 = self.create_project(organization=self.organization)
        project_3 = self.create_project(organization=self.organization)

        detector_1 = self.create_detector(project=project_1, name="Detector 1")
        detector_2 = self.create_detector(project=project_2, name="Detector 2")
        detector_3 = self.create_detector(project=project_3, name="Detector 3")

        self.create_detector_workflow(workflow=self.workflow, detector=detector_1)
        self.create_detector_workflow(workflow=self.workflow_two, detector=detector_2)
        self.create_detector_workflow(workflow=self.workflow_three, detector=detector_3)

        # Filter by single detector
        response = self.get_success_response(
            self.organization.slug,
            qs_params={"detector": str(detector_1.id)},
        )
        assert len(response.data) == 1
        assert response.data[0]["name"] == self.workflow.name

        # Filter by multiple detectors
        response2 = self.get_success_response(
            self.organization.slug,
            qs_params=[
                ("detector", str(detector_1.id)),
                ("detector", str(detector_2.id)),
            ],
        )
        assert len(response2.data) == 2
        assert {w["name"] for w in response2.data} == {self.workflow.name, self.workflow_two.name}

        # Filter by non-existent detector ID returns no results
        response3 = self.get_success_response(
            self.organization.slug,
            qs_params={"detector": "999999"},
        )
        assert len(response3.data) == 0

        # Invalid detector ID format returns error
        response4 = self.get_error_response(
            self.organization.slug,
            qs_params={"detector": "not-an-id"},
            status_code=400,
        )
        assert response4.data == {"detector": ["Invalid detector ID format"]}

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
class OrganizationWorkflowCreateTest(OrganizationWorkflowAPITestCase, BaseWorkflowTest):
    method = "POST"

    def setUp(self) -> None:
        super().setUp()
        self.integration, self.org_integration = self.create_provider_integration_for(
            provider="slack", organization=self.organization, user=self.user
        )
        self.valid_workflow = {
            "name": "Test Workflow",
            "enabled": True,
            "config": {},
            "triggers": {"logicType": "any", "conditions": []},
            "actionFilters": [],
        }
        self.member_user = self.create_user()
        self.create_member(
            team_roles=[(self.team, "contributor")],
            user=self.member_user,
            role="member",
            organization=self.organization,
        )
        self.basic_condition = [
            {
                "type": Condition.EQUAL.value,
                "comparison": 1,
                "conditionResult": True,
            }
        ]
        self.sentry_app, _ = self.create_sentry_app_with_schema()
        self.sentry_app_settings = [
            {"name": "alert_prefix", "value": "[Not Good]"},
            {"name": "channel", "value": "#ignored-errors"},
            {"name": "best_emoji", "value": ":fire:"},
            {"name": "teamId", "value": "1"},
            {"name": "assigneeId", "value": "3"},
        ]

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
        assert response.data == serialize(new_workflow)

    def test_create_workflow__with_triggers(self) -> None:
        self.valid_workflow["triggers"] = {
            "logicType": "any",
            "conditions": self.basic_condition,
        }

        response = self.get_success_response(
            self.organization.slug,
            raw_data=self.valid_workflow,
        )

        assert response.status_code == 201
        new_workflow = Workflow.objects.get(id=response.data["id"])
        assert response.data == serialize(new_workflow)

    @mock.patch(
        "sentry.notifications.notification_action.registry.action_validator_registry.get",
        return_value=MockActionValidatorTranslator,
    )
    def test_create_workflow__with_actions(self, mock_action_validator: mock.MagicMock) -> None:
        self.valid_workflow["actionFilters"] = [
            {
                "logicType": "any",
                "conditions": self.basic_condition,
                "actions": [
                    {
                        "type": Action.Type.SLACK,
                        "config": {
                            "targetIdentifier": "test",
                            "targetDisplay": "Test",
                            "targetType": "specific",
                        },
                        "data": {},
                        "integrationId": self.integration.id,
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
        assert response.data == serialize(new_workflow)

    @mock.patch(
        "sentry.notifications.notification_action.registry.action_validator_registry.get",
        return_value=MockActionValidatorTranslator,
    )
    def test_create_workflow__with_fallthrough_type_action(
        self, mock_action_validator: mock.MagicMock
    ) -> None:
        self.valid_workflow["actionFilters"] = [
            {
                "logicType": "any",
                "conditions": self.basic_condition,
                "actions": [
                    {
                        "type": Action.Type.EMAIL,
                        "config": {
                            "targetType": "issue_owners",
                        },
                        "data": {"fallthroughType": "ActiveMembers"},
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
        assert response.data == serialize(new_workflow)

    @responses.activate
    def test_create_workflow_with_sentry_app_action(self) -> None:
        """
        Test that you can add a sentry app with settings
        (e.g. a sentry app that makes a ticket in some 3rd party system as opposed to one without settings)
        """
        responses.add(
            method=responses.POST,
            url="https://example.com/sentry/alert-rule",
            status=200,
        )
        self.valid_workflow["actionFilters"] = [
            {
                "logicType": "any",
                "conditions": self.basic_condition,
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
            self.organization.slug,
            raw_data=self.valid_workflow,
        )
        updated_workflow = Workflow.objects.get(id=response.data["id"])
        assert response.data == serialize(updated_workflow)

    @responses.activate
    def test_create_sentry_app_action_missing_settings(self) -> None:
        """
        Test that if you forget to pass settings to your sentry app action it will fail and tell you why.
        Settings are only required if the sentry app schema is not an empty dict
        """
        responses.add(
            method=responses.POST,
            url="https://example.com/sentry/alert-rule",
            status=200,
        )

        self.valid_workflow["actionFilters"] = [
            {
                "logicType": "any",
                "conditions": self.basic_condition,
                "actions": [
                    {
                        "config": {
                            "sentryAppIdentifier": SentryAppIdentifier.SENTRY_APP_ID,
                            "targetIdentifier": str(self.sentry_app.id),
                            "targetType": ActionType.SENTRY_APP,
                        },
                        "data": {},
                        "type": Action.Type.SENTRY_APP,
                    },
                ],
            }
        ]
        response = self.get_response(
            self.organization.slug,
            raw_data=self.valid_workflow,
        )

        assert response.status_code == 400
        assert "'settings' is a required property" in str(response.data).lower()

    @responses.activate
    def test_create_sentry_app_action_no_settings(self) -> None:
        """
        Test that if you are creating a sentry app action for a sentry app that has no schema it works as expected when settings are not passed
        because settings are not expected
        """
        sentry_app = self.create_sentry_app(
            name="Moo Deng's Wind Sentry App",
            organization=self.organization,
            is_alertable=True,
        )
        self.create_sentry_app_installation(slug=sentry_app.slug, organization=self.organization)

        responses.add(
            method=responses.POST,
            url="https://example.com/sentry/alert-rule",
            status=200,
        )

        self.valid_workflow["actionFilters"] = [
            {
                "logicType": "any",
                "conditions": self.basic_condition,
                "actions": [
                    {
                        "config": {
                            "sentryAppIdentifier": SentryAppIdentifier.SENTRY_APP_ID,
                            "targetIdentifier": str(sentry_app.id),
                            "targetType": ActionType.SENTRY_APP,
                        },
                        "data": {},
                        "type": Action.Type.SENTRY_APP,
                    },
                ],
            }
        ]
        response = self.get_success_response(
            self.organization.slug,
            raw_data=self.valid_workflow,
        )
        updated_workflow = Workflow.objects.get(id=response.data["id"])
        assert response.data == serialize(updated_workflow)

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

    @mock.patch("sentry.workflow_engine.endpoints.validators.detector_workflow.create_audit_entry")
    def test_create_workflow_connected_to_error_detector(self, mock_audit: mock.MagicMock) -> None:
        """
        Tests that a member can create workflows with connections to a system-created detector
        """
        error_detector = self.create_detector(project=self.project, type=ErrorGroupType.slug)
        workflow_data = {**self.valid_workflow, "detectorIds": [error_detector.id]}

        self.login_as(user=self.member_user)

        response = self.get_success_response(
            self.organization.slug,
            raw_data=workflow_data,
        )

        assert response.status_code == 201

        created_detector_workflows = DetectorWorkflow.objects.filter(
            workflow_id=response.data["id"]
        )
        assert created_detector_workflows.count() == 1
        assert created_detector_workflows.get().detector_id == error_detector.id

        detector_workflow_audit_calls = [
            call
            for call in mock_audit.call_args_list
            if call.kwargs.get("event") == audit_log.get_event_id("DETECTOR_WORKFLOW_ADD")
        ]
        assert len(detector_workflow_audit_calls) == 1

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

    def test_create_workflow_with_other_project_detector(self) -> None:
        self.organization.update_option("sentry:alerts_member_write", True)
        self.organization.flags.allow_joinleave = False
        self.organization.save()

        self.login_as(user=self.member_user)

        # other_detector is a part of a project which the member does not have access to
        other_detector = self.create_detector(
            project=self.create_project(organization=self.organization, teams=[]),
            created_by_id=self.user.id,
        )

        workflow_data = {
            **self.valid_workflow,
            "detectorIds": [other_detector.id],
        }

        self.get_success_response(
            self.organization.slug,
            raw_data=workflow_data,
        )

        # Verify detector-workflow connections was created
        created_detector_workflows = DetectorWorkflow.objects.all()
        assert created_detector_workflows.count() == 1

    def test_cannot_create_workflow_without_alerts_write(self) -> None:
        self.organization.update_option("sentry:alerts_member_write", False)
        self.login_as(user=self.member_user)

        self.get_error_response(
            self.organization.slug,
            raw_data=self.valid_workflow,
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

    def test_bulk_enable_workflows_by_ids_success(self) -> None:
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

    def test_bulk_disable_workflows_by_ids_success(self) -> None:
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

    def test_bulk_enable_workflows_by_query_success(self) -> None:
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

    def test_bulk_update_workflows_no_parameters_error(self) -> None:
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

    def test_bulk_update_workflows_missing_enabled_field_error(self) -> None:
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

    def test_bulk_update_no_matching_workflows(self) -> None:
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
