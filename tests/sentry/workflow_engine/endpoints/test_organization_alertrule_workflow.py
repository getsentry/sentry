from sentry.api.serializers import serialize
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import cell_silo_test
from sentry.workflow_engine.models import AlertRuleDetector, AlertRuleWorkflow


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
        self.detector = self.create_detector(project=self.project)
        self.create_alert_rule_detector(alert_rule_id=12345, detector=self.detector)
        self.create_alert_rule_detector(rule_id=67890, detector=self.detector)
        self.create_alert_rule_detector(alert_rule_id=11111, detector=self.detector)
        self.create_detector_workflow(detector=self.detector, workflow=self.workflow_1)
        self.create_detector_workflow(detector=self.detector, workflow=self.workflow_2)

        # Create workflow in different organization to test filtering
        self.other_org = self.create_organization()
        self.other_workflow = self.create_workflow(organization=self.other_org)
        self.other_alert_rule_workflow = self.create_alert_rule_workflow(
            alert_rule_id=99999, workflow=self.other_workflow
        )


@cell_silo_test
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

    def test_get_with_non_integer_workflow_id(self) -> None:
        self.get_error_response(
            self.organization.slug,
            workflow_id="not-an-integer",
            status_code=400,
        )

    def test_get_with_non_integer_alert_rule_id(self) -> None:
        self.get_error_response(
            self.organization.slug,
            alert_rule_id="not-an-integer",
            status_code=400,
        )

    def test_get_with_non_integer_rule_id(self) -> None:
        self.get_error_response(
            self.organization.slug,
            rule_id="not-an-integer",
            status_code=400,
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


@cell_silo_test
class OrganizationAlertRuleWorkflowProjectAccessTest(OrganizationAlertRuleWorkflowAPITestCase):
    def setUp(self) -> None:
        super().setUp()
        self.organization.flags.allow_joinleave = False
        self.organization.save()
        self.member = self.create_user(is_superuser=False)
        self.create_member(
            user=self.member, organization=self.organization, role="member", teams=[]
        )
        self.login_as(self.member)

    def test_mapping_requires_source_project_access(self) -> None:
        self.get_error_response(
            self.organization.slug, workflow_id=self.workflow_1.id, status_code=404
        )
        self.get_error_response(self.organization.slug, rule_id=67890, status_code=404)
        self.get_error_response(self.organization.slug, alert_rule_id=12345, status_code=404)
        # A detached workflow must not make its legacy mapping organization-visible.
        self.get_error_response(
            self.organization.slug, workflow_id=self.workflow_3.id, status_code=404
        )

        self.create_team_membership(team=self.team, user=self.member)
        response = self.get_success_response(self.organization.slug, rule_id=67890)
        assert response.data == serialize(self.alert_rule_workflow_2, self.member)
        response = self.get_success_response(self.organization.slug, alert_rule_id=12345)
        assert response.data == serialize(self.alert_rule_workflow_1, self.member)
        response = self.get_success_response(self.organization.slug, workflow_id=self.workflow_3.id)
        assert response.data == serialize(self.alert_rule_workflow_3, self.member)

    def test_legacy_source_resolution(self) -> None:
        rule = self.create_project_rule(project=self.project)
        mapping = AlertRuleWorkflow.objects.get(rule_id=rule.id)
        AlertRuleDetector.objects.filter(rule_id=rule.id).delete()
        self.get_error_response(self.organization.slug, rule_id=rule.id, status_code=404)

        self.create_team_membership(team=self.team, user=self.member)
        response = self.get_success_response(self.organization.slug, rule_id=rule.id)
        assert response.data == serialize(mapping, self.member)

        # Even an accessible workflow cannot authorize a mapping with no source.
        orphan = self.create_alert_rule_workflow(rule_id=987654321, workflow=mapping.workflow)
        self.get_error_response(self.organization.slug, rule_id=orphan.rule_id, status_code=404)

    def test_shared_workflow_only_returns_accessible_mapping(self) -> None:
        rule = self.create_project_rule(project=self.project)
        AlertRuleWorkflow.objects.filter(rule_id=rule.id).update(workflow=self.workflow_1)
        accessible_team = self.create_team(organization=self.organization)
        accessible_project = self.create_project(
            organization=self.organization, teams=[accessible_team]
        )
        self.create_team_membership(team=accessible_team, user=self.member)
        detector = self.create_detector(project=accessible_project)
        self.create_detector_workflow(detector=detector, workflow=self.workflow_1)
        self.create_alert_rule_detector(alert_rule_id=22222, detector=detector)
        accessible_mapping = self.create_alert_rule_workflow(
            alert_rule_id=22222, workflow=self.workflow_1
        )

        # The older, inaccessible mapping must not be selected by first().
        response = self.get_success_response(self.organization.slug, workflow_id=self.workflow_1.id)
        assert response.data == serialize(accessible_mapping, self.member)
        self.get_error_response(self.organization.slug, alert_rule_id=12345, status_code=404)
        self.get_error_response(self.organization.slug, rule_id=rule.id, status_code=404)
        self.get_error_response(
            self.organization.slug,
            workflow_id=self.workflow_1.id,
            alert_rule_id=12345,
            status_code=404,
        )
