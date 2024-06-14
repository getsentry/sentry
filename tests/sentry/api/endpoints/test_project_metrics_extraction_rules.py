from django.urls import reverse

from sentry.models.apitoken import ApiToken
from sentry.sentry_metrics.extraction_rules import MetricsExtractionRuleState
from sentry.silo.base import SiloMode
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import assume_test_silo_mode


class ProjectMetricsExtractionEndpointTestCase(APITestCase):
    endpoint = "sentry-api-0-project-metrics-extraction-rules"

    def setUp(self):
        self.login_as(user=self.user)

    def send_put_request(self, token, endpoint):
        url = reverse(endpoint, args=(self.project.organization.slug, self.project.slug))
        return self.client.put(url, HTTP_AUTHORIZATION=f"Bearer {token.token}", format="json")

    def test_permissions(self):
        with assume_test_silo_mode(SiloMode.CONTROL):
            token = ApiToken.objects.create(user=self.user, scope_list=[])

        response = self.send_put_request(token, self.endpoint)
        assert response.status_code == 403

        with assume_test_silo_mode(SiloMode.CONTROL):
            token = ApiToken.objects.create(user=self.user, scope_list=["project:write"])

        response = self.send_put_request(token, self.endpoint)
        assert response.status_code != 403

    def test_create_new_extraction_rule(self):
        new_rule_json_1 = """[{"span_attribute": "count_clicks", "type": "c","unit": "none","tags": ["tag1", "tag2", "tag3"]}]"""

        response = self.get_success_response(
            self.organization.slug,
            self.project.slug,
            method="put",
            metricsExtractionRules=new_rule_json_1,
        )

        assert response.status_code == 200
        data = response.data
        assert len(data) == 1
        assert data[0]["span_attribute"] == "count_clicks"
        assert data[0]["type"] == "c"
        assert data[0]["unit"] == "none"
        assert set(data[0]["tags"]) == {"tag1", "tag2", "tag3"}

        new_rule_json_2 = (
            """[{"span_attribute": "process_latency", "type": "d","unit": "ms","tags": ["tag3"]}]"""
        )

        response = self.get_success_response(
            self.organization.slug,
            self.project.slug,
            method="put",
            metricsExtractionRules=new_rule_json_2,
        )
        assert response.status_code == 200
        data = response.data
        assert len(data) == 2
        assert data[1]["span_attribute"] == "process_latency"
        assert data[1]["type"] == "d"
        assert data[1]["unit"] == "ms"
        assert set(data[1]["tags"]) == {"tag3"}

        project_state = MetricsExtractionRuleState.load_from_project(self.project)
        project_rules = project_state.get_rules()
        assert len(project_rules) == 2
        assert ["count_clicks", "process_latency"] == sorted(
            r.span_attribute for r in project_rules
        )

    def test_update_existing_extraction_rule(self):
        original_rule_json = (
            """[{"span_attribute": "process_latency", "type": "d","unit": "ms","tags": ["tag3"]}]"""
        )

        response = self.get_success_response(
            self.organization.slug,
            self.project.slug,
            method="put",
            metricsExtractionRules=original_rule_json,
        )
        assert response.status_code == 200

        updated_rule_json = """[{"span_attribute": "process_latency", "type": "d","unit": "ms","tags": ["tag3", "new_tag"]}]"""

        response = self.get_success_response(
            self.organization.slug,
            self.project.slug,
            method="put",
            metricsExtractionRules=updated_rule_json,
        )
        assert response.status_code == 200
        data = response.data
        assert len(data) == 1
        assert data[0]["span_attribute"] == "process_latency"
        assert data[0]["type"] == "d"
        assert data[0]["unit"] == "ms"
        assert set(data[0]["tags"]) == {"tag3", "new_tag"}

        project_state = MetricsExtractionRuleState.load_from_project(self.project)
        project_rules = project_state.get_rules()
        assert len(project_rules) == 1
        assert ["process_latency"] == sorted(r.span_attribute for r in project_rules)

    def test_delete_existing_extraction_rule(self):
        new_rule_json_1 = """[{"span_attribute": "count_clicks", "type": "c","unit": "none","tags": ["tag1", "tag2", "tag3"]}]"""

        response = self.get_success_response(
            self.organization.slug,
            self.project.slug,
            method="put",
            metricsExtractionRules=new_rule_json_1,
        )

        assert response.status_code == 200
        data = response.data
        assert len(data) == 1
        assert data[0]["span_attribute"] == "count_clicks"
        assert data[0]["type"] == "c"
        assert data[0]["unit"] == "none"
        assert set(data[0]["tags"]) == {"tag1", "tag2", "tag3"}

        new_rule_json_2 = (
            """[{"span_attribute": "process_latency", "type": "d","unit": "ms","tags": ["tag3"]}]"""
        )

        response = self.get_success_response(
            self.organization.slug,
            self.project.slug,
            method="put",
            metricsExtractionRules=new_rule_json_2,
        )
        assert response.status_code == 200
        data = response.data
        assert len(data) == 2
        assert data[1]["span_attribute"] == "process_latency"
        assert data[1]["type"] == "d"
        assert data[1]["unit"] == "ms"
        assert set(data[1]["tags"]) == {"tag3"}

        project_state = MetricsExtractionRuleState.load_from_project(self.project)
        project_rules = project_state.get_rules()
        assert len(project_rules) == 2
        assert ["count_clicks", "process_latency"] == sorted(
            r.span_attribute for r in project_rules
        )

        response = self.get_response(
            self.organization.slug,
            self.project.slug,
            method="delete",
            metricsExtractionRules=new_rule_json_2,
        )
        assert response.status_code == 200
        data = response.data
        assert len(data) == 1

        project_state = MetricsExtractionRuleState.load_from_project(self.project)
        project_rules = project_state.get_rules()
        assert len(project_rules) == 1
        assert ["count_clicks"] == [r.span_attribute for r in project_rules]

    def test_delete_non_existing_extraction_rule(self):
        assert False
