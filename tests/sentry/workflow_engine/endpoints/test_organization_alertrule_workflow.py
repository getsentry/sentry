from sentry.api.serializers import serialize
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import region_silo_test


class OrganizationAlertRuleWorkflowAPITestCase(APITestCase):
    endpoint = "sentry-api-0-organization-alert-rule-workflow-index"

    def setUp(self) -> None:
        super().setUp()
        self.login_as(user=self.user)

        self.workflow_1 = self.create_workflow(organization=self.organization)
        self.workflow_2 = self.create_workflow(organization=self.organization)
        self.workflow_3 = self.create_workflow(organization=self.organization)

        self.alert_rule_workflow_1 = self.create_alert_rule_workflow(
            alert_rule_id=12345, workflow=self.workflow_1
        )
        self.alert_rule_workflow_2 = self.create_alert_rule_workflow(
            rule_id=67890, workflow=self.workflow_2
        )
        self.alert_rule_workflow_3 = self.create_alert_rule_workflow(
            alert_rule_id=11111, workflow=self.workflow_3
        )

        # Create workflow in different organization to test filtering
        self.other_org = self.create_organization()
        self.other_workflow = self.create_workflow(organization=self.other_org)
        self.other_alert_rule_workflow = self.create_alert_rule_workflow(
            alert_rule_id=99999, workflow=self.other_workflow
        )


@region_silo_test
class OrganizationAlertRuleWorkflowIndexGetTest(OrganizationAlertRuleWorkflowAPITestCase):
    def test_get_with_workflow_id_filter(self) -> None:
        response = self.get_success_response(
            self.organization.slug, workflow_id=str(self.workflow_1.id)
        )
        assert response.data == serialize(self.alert_rule_workflow_1, self.user)

    def test_get_with_alert_rule_id_filter(self) -> None:
        response = self.get_success_response(self.organization.slug, alert_rule_id="12345")

        assert response.data["alertRuleId"] == "12345"
        assert response.data["ruleId"] is None
        assert response.data["workflowId"] == str(self.workflow_1.id)

    def test_get_with_rule_id_filter(self) -> None:
        response = self.get_success_response(self.organization.slug, rule_id="67890")

        assert response.data["ruleId"] == "67890"
        assert response.data["alertRuleId"] is None
        assert response.data["workflowId"] == str(self.workflow_2.id)

    def test_get_with_multiple_filters(self) -> None:
        response = self.get_success_response(
            self.organization.slug,
            workflow_id=str(self.workflow_1.id),
            alert_rule_id="12345",
        )

        assert response.data == serialize(self.alert_rule_workflow_1, self.user)

    def test_get_with_multiple_filters_with_invalid_filter(self) -> None:
        self.get_error_response(
            self.organization.slug,
            workflow_id=str(self.workflow_1.id),
            alert_rule_id="this is not a valid ID",
        )

    def test_get_with_nonexistent_workflow_id(self) -> None:
        self.get_error_response(self.organization.slug, workflow_id="99999", status_code=404)

    def test_get_with_nonexistent_alert_rule_id(self) -> None:
        self.get_error_response(self.organization.slug, alert_rule_id="99999", status_code=404)

    def test_get_with_nonexistent_rule_id(self) -> None:
        self.get_error_response(self.organization.slug, rule_id="99999", status_code=404)

    def test_organization_isolation(self) -> None:
        self.get_error_response(
            self.organization.slug, workflow_id=str(self.other_workflow.id), status_code=404
        )
