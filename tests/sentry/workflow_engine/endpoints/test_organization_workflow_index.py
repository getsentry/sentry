from sentry.api.serializers import serialize
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import region_silo_test
from sentry.workflow_engine.models import Action, Workflow, WorkflowDataConditionGroup


class OrganizationWorkflowAPITestCase(APITestCase):
    endpoint = "sentry-api-0-organization-workflow-index"

    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)


@region_silo_test
class OrganizationWorkflowIndexBaseTest(OrganizationWorkflowAPITestCase):
    def test_simple(self):
        workflow = self.create_workflow(organization_id=self.organization.id, name="Test Workflow")

        workflow_two = self.create_workflow(
            organization_id=self.organization.id, name="Test Workflow 2"
        )

        response = self.get_success_response(self.organization.slug)
        assert response.data == serialize([workflow, workflow_two])

    def test_empty_result(self):
        response = self.get_success_response(self.organization.slug)
        assert response.data == []

    def test_sort_by_name(self):
        workflow = self.create_workflow(
            organization_id=self.organization.id, name="A Test Workflow"
        )
        workflow_two = self.create_workflow(
            organization_id=self.organization.id, name="B Test Workflow 2"
        )

        response = self.get_success_response(self.organization.slug, qs_params={"sortBy": "-name"})
        assert [w["name"] for w in response.data] == [
            workflow_two.name,
            workflow.name,
        ]
        response2 = self.get_success_response(self.organization.slug, qs_params={"sortBy": "name"})
        assert [w["name"] for w in response2.data] == [
            workflow.name,
            workflow_two.name,
        ]

    def test_sort_by_connected_detectors(self):
        workflow = self.create_workflow(
            organization_id=self.organization.id, name="A Test Workflow"
        )
        workflow_two = self.create_workflow(
            organization_id=self.organization.id, name="B Test Workflow 2"
        )

        detector = self.create_detector(project=self.project, name="A Test Detector")
        detector_two = self.create_detector(project=self.project, name="B Test Detector 2")

        self.create_detector_workflow(
            workflow=workflow,
            detector=detector,
        )
        self.create_detector_workflow(
            workflow=workflow,
            detector=detector_two,
        )

        response = self.get_success_response(
            self.organization.slug, qs_params={"sortBy": "connectedDetectors"}
        )
        assert [w["name"] for w in response.data] == [
            workflow_two.name,
            workflow.name,
        ]

        response2 = self.get_success_response(
            self.organization.slug, qs_params={"sortBy": "-connectedDetectors"}
        )
        assert [w["name"] for w in response2.data] == [
            workflow.name,
            workflow_two.name,
        ]

    def test_invalid_sort_by(self):
        response = self.get_error_response(
            self.organization.slug, qs_params={"sortBy": "not_a_valid_sort_by_field"}
        )
        assert "sortBy" in response.data

    def test_sort_by_actions(self):
        workflow = self.create_workflow(
            organization_id=self.organization.id, name="A Test Workflow"
        )
        workflow_two = self.create_workflow(
            organization_id=self.organization.id, name="B Test Workflow 2"
        )

        # First workflow gets 2 actions, second gets none.
        dcg1 = self.create_data_condition_group(organization=self.organization)
        action1 = self.create_action()
        self.create_data_condition_group_action(condition_group=dcg1, action=action1)
        self.create_workflow_data_condition_group(
            condition_group=dcg1,
            workflow=workflow,
        )
        dcg2 = self.create_data_condition_group(organization=self.organization)
        action2 = self.create_action()
        self.create_data_condition_group_action(condition_group=dcg2, action=action2)
        self.create_workflow_data_condition_group(
            condition_group=dcg2,
            workflow=workflow,
        )

        response = self.get_success_response(
            self.organization.slug, qs_params={"sortBy": "actions"}
        )
        assert [w["name"] for w in response.data] == [
            workflow_two.name,
            workflow.name,
        ]

        response2 = self.get_success_response(
            self.organization.slug, qs_params={"sortBy": "-actions"}
        )
        assert [w["name"] for w in response2.data] == [
            workflow.name,
            workflow_two.name,
        ]


@region_silo_test
class OrganizationWorkflowCreateTest(OrganizationWorkflowAPITestCase):
    method = "POST"

    def setUp(self):
        super().setUp()
        self.valid_workflow = {
            "name": "Test Workflow",
            "enabled": True,
            "config": {},
            "triggers": {"logicType": "any", "conditions": []},
            "action_filters": [],
        }

    def test_create_workflow__basic(self):
        response = self.get_success_response(
            self.organization.slug,
            raw_data=self.valid_workflow,
        )

        assert response.status_code == 201
        new_workflow = Workflow.objects.get(id=response.data["id"])
        assert new_workflow.name == self.valid_workflow["name"]

    def test_create_workflow__with_config(self):
        self.valid_workflow["config"] = {"frequency": 100}
        response = self.get_success_response(
            self.organization.slug,
            raw_data=self.valid_workflow,
        )

        assert response.status_code == 201
        new_workflow = Workflow.objects.get(id=response.data["id"])
        assert new_workflow.config == self.valid_workflow["config"]

    def test_create_workflow__with_triggers(self):
        self.valid_workflow["triggers"] = {
            "logicType": "any",
            "conditions": [
                {
                    "type": "eq",
                    "comparison": 1,
                    "condition_result": True,
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

    def test_create_workflow__with_actions(self):
        self.valid_workflow["actionFilters"] = [
            {
                "logicType": "any",
                "conditions": [
                    {
                        "type": "eq",
                        "comparison": 1,
                        "condition_result": True,
                    }
                ],
                "actions": [
                    {
                        "type": Action.Type.SLACK,
                        "config": {
                            "target_identifier": "test",
                            "target_display": "Test",
                            "target_type": 0,
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

    def test_create_invalid_workflow(self):
        self.valid_workflow["name"] = ""
        response = self.get_response(
            self.organization.slug,
            raw_data=self.valid_workflow,
        )

        assert response.status_code == 400

    def test_create_workflow__invalid_triggers(self):
        self.valid_workflow["triggers"] = {
            "logicType": "some",
            "conditions": [
                {
                    "comparison": 1,
                    "condition_result": True,
                }
            ],
        }

        response = self.get_response(
            self.organization.slug,
            raw_data=self.valid_workflow,
        )

        assert response.status_code == 400

    def test_create_workflow__invalid_actions(self):
        self.valid_workflow["actionFilters"] = [
            {
                "logicType": "some",
                "conditions": [
                    {
                        "comparison": 1,
                        "condition_result": True,
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
