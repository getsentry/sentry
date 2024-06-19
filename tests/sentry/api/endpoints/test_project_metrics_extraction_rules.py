from django.urls import reverse

from sentry.models.apitoken import ApiToken
from sentry.sentry_metrics.extraction_rules import MetricsExtractionRuleState
from sentry.silo.base import SiloMode
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers import with_feature
from sentry.testutils.silo import assume_test_silo_mode


class ProjectMetricsExtractionEndpointTestCase(APITestCase):
    endpoint = "sentry-api-0-project-metrics-extraction-rules"

    def setUp(self):
        self.login_as(user=self.user)

    @with_feature("organizations:custom-metrics-extraction-rule")
    def send_put_request(self, token, endpoint):
        url = reverse(endpoint, args=(self.project.organization.slug, self.project.slug))
        return self.client.put(url, HTTP_AUTHORIZATION=f"Bearer {token.token}", format="json")

    @with_feature("organizations:custom-metrics-extraction-rule")
    def test_permissions(self):
        with assume_test_silo_mode(SiloMode.CONTROL):
            token = ApiToken.objects.create(user=self.user, scope_list=[])

        response = self.send_put_request(token, self.endpoint)
        assert response.status_code == 403

        with assume_test_silo_mode(SiloMode.CONTROL):
            token = ApiToken.objects.create(user=self.user, scope_list=["project:write"])

        response = self.send_put_request(token, self.endpoint)
        assert response.status_code != 403

    @with_feature("organizations:custom-metrics-extraction-rule")
    def test_create_new_extraction_rule(self):
        new_rule_1 = {
            "metricsExtractionRules": [
                {
                    "spanAttribute": "count_clicks",
                    "type": "c",
                    "unit": "none",
                    "tags": ["tag1", "tag2", "tag3"],
                    "conditions": ["foo:bar", "baz:faz"],
                }
            ]
        }

        response = self.get_response(
            self.organization.slug,
            self.project.slug,
            method="post",
            **new_rule_1,
        )

        assert response.status_code == 200
        data = response.data
        assert len(data) == 1
        assert data[0]["spanAttribute"] == "count_clicks"
        assert data[0]["type"] == "c"
        assert data[0]["unit"] == "none"
        assert set(data[0]["tags"]) == {"tag1", "tag2", "tag3"}

        new_rule_2 = {
            "metricsExtractionRules": [
                {
                    "spanAttribute": "process_latency",
                    "type": "d",
                    "unit": "ms",
                    "tags": ["tag3"],
                    "conditions": ["hello:world", "baz:faz"],
                }
            ]
        }

        response = self.get_success_response(
            self.organization.slug,
            self.project.slug,
            method="post",
            **new_rule_2,
        )
        assert response.status_code == 200
        data = response.data
        assert len(data) == 2
        assert data[1]["spanAttribute"] == "process_latency"
        assert data[1]["type"] == "d"
        assert data[1]["unit"] == "none"
        assert data[1]["conditions"] == ["hello:world", "baz:faz"]
        assert set(data[1]["tags"]) == {"tag3"}

        project_state = MetricsExtractionRuleState.load_from_project(self.project)
        project_rules = project_state.get_rules()
        assert len(project_rules) == 2
        assert ["count_clicks", "process_latency"] == sorted(
            r.span_attribute for r in project_rules
        )

    @with_feature("organizations:custom-metrics-extraction-rule")
    def test_create_new_extraction_rule_hardcoded_units(self):
        new_rule_json_1 = {
            "metricsExtractionRules": [
                {
                    "spanAttribute": "span.duration",
                    "type": "d",
                    "unit": "none",
                    "tags": ["tag1", "tag2", "tag3"],
                    "conditions": ["foo:bar", "baz:faz"],
                }
            ]
        }

        response = self.get_response(
            self.organization.slug,
            self.project.slug,
            method="post",
            **new_rule_json_1,
        )

        assert response.status_code == 200
        data = response.data
        assert len(data) == 1
        assert data[0]["spanAttribute"] == "span.duration"
        assert data[0]["type"] == "d"
        assert data[0]["unit"] == "millisecond"
        assert set(data[0]["tags"]) == {"tag1", "tag2", "tag3"}

    @with_feature("organizations:custom-metrics-extraction-rule")
    def test_update_existing_extraction_rule(self):
        original_rule = {
            "metricsExtractionRules": [
                {"spanAttribute": "process_latency", "type": "d", "unit": "ms", "tags": ["tag3"]}
            ]
        }

        response = self.get_success_response(
            self.organization.slug,
            self.project.slug,
            method="put",
            **original_rule,
        )
        assert response.status_code == 200

        updated_rule = {
            "metricsExtractionRules": [
                {
                    "spanAttribute": "process_latency",
                    "type": "d",
                    "unit": "ms",
                    "tags": ["tag3", "new_tag"],
                }
            ]
        }

        response = self.get_success_response(
            self.organization.slug,
            self.project.slug,
            method="put",
            **updated_rule,
        )
        assert response.status_code == 200
        data = response.data
        assert len(data) == 1
        assert data[0]["spanAttribute"] == "process_latency"
        assert data[0]["type"] == "d"
        assert data[0]["unit"] == "none"
        assert set(data[0]["tags"]) == {"tag3", "new_tag"}

        project_state = MetricsExtractionRuleState.load_from_project(self.project)
        project_rules = project_state.get_rules()
        assert len(project_rules) == 1
        assert ["process_latency"] == sorted(r.span_attribute for r in project_rules)

    @with_feature("organizations:custom-metrics-extraction-rule")
    def test_delete_existing_extraction_rule(self):
        new_rule = {
            "metricsExtractionRules": [
                {
                    "spanAttribute": "count_clicks",
                    "type": "c",
                    "unit": "none",
                    "tags": ["tag1", "tag2", "tag3"],
                }
            ]
        }

        response = self.get_success_response(
            self.organization.slug,
            self.project.slug,
            method="post",
            **new_rule,
        )

        assert response.status_code == 200
        data = response.data
        assert len(data) == 1
        assert data[0]["spanAttribute"] == "count_clicks"
        assert data[0]["type"] == "c"
        assert data[0]["unit"] == "none"
        assert set(data[0]["tags"]) == {"tag1", "tag2", "tag3"}

        new_rule_2 = {
            "metricsExtractionRules": [
                {"spanAttribute": "process_latency", "type": "d", "unit": "ms", "tags": ["tag3"]}
            ]
        }

        response = self.get_success_response(
            self.organization.slug,
            self.project.slug,
            method="post",
            **new_rule_2,
        )
        assert response.status_code == 200
        data = response.data
        assert len(data) == 2
        assert data[1]["spanAttribute"] == "process_latency"
        assert data[1]["type"] == "d"
        assert data[1]["unit"] == "none"
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
            **new_rule_2,
        )
        assert response.status_code == 204

        project_state = MetricsExtractionRuleState.load_from_project(self.project)
        project_rules = project_state.get_rules()
        assert len(project_rules) == 1
        assert ["count_clicks"] == [r.span_attribute for r in project_rules]

    @with_feature("organizations:custom-metrics-extraction-rule")
    def test_idempotent_update(self):
        rule = {
            "metricsExtractionRules": [
                {"spanAttribute": "process_latency", "type": "d", "unit": "ms", "tags": ["tag3"]}
            ]
        }

        response = self.get_success_response(
            self.organization.slug,
            self.project.slug,
            method="post",
            **rule,
        )
        assert response.status_code == 200

        response = self.get_success_response(
            self.organization.slug,
            self.project.slug,
            method="put",
            **rule,
        )
        assert response.status_code == 200
        data = response.data
        assert len(data) == 1
        assert data[0]["spanAttribute"] == "process_latency"
        assert data[0]["type"] == "d"
        assert data[0]["unit"] == "none"
        assert set(data[0]["tags"]) == {"tag3"}

        project_state = MetricsExtractionRuleState.load_from_project(self.project)
        project_rules = project_state.get_rules()
        assert len(project_rules) == 1
        assert ["process_latency"] == sorted(r.span_attribute for r in project_rules)

    @with_feature("organizations:custom-metrics-extraction-rule")
    def test_delete_non_existing_extraction_rule(self):
        non_existing_rule = {
            "metricsExtractionRules": [
                {"spanAttribute": "process_latency", "type": "d", "unit": "ms", "tags": ["tag3"]}
            ]
        }

        response = self.get_response(
            self.organization.slug,
            self.project.slug,
            method="delete",
            **non_existing_rule,
        )
        assert response.status_code == 204

    def test_option_hides_endpoints(self):
        rule = {
            "metricsExtractionRules": [
                {"spanAttribute": "process_latency", "type": "d", "unit": "ms", "tags": ["tag3"]}
            ]
        }

        response = self.get_response(
            self.organization.slug,
            self.project.slug,
            method="put",
            **rule,
        )
        assert response.status_code == 404

        response = self.get_response(
            self.organization.slug,
            self.project.slug,
            method="delete",
            **rule,
        )
        assert response.status_code == 404

        response = self.get_response(
            self.organization.slug,
            self.project.slug,
            method="post",
            **rule,
        )
        assert response.status_code == 404

        response = self.get_response(
            self.organization.slug,
            self.project.slug,
            method="get",
        )
        assert response.status_code == 404

    @with_feature("organizations:custom-metrics-extraction-rule")
    def test_get_extraction_rules(self):

        new_rule_1 = {
            "metricsExtractionRules": [
                {
                    "spanAttribute": "count_clicks",
                    "type": "c",
                    "unit": "none",
                    "tags": ["tag1", "tag2", "tag3"],
                }
            ]
        }

        response = self.get_success_response(
            self.organization.slug,
            self.project.slug,
            method="post",
            **new_rule_1,
        )

        assert response.status_code == 200

        new_rule_2 = {
            "metricsExtractionRules": [
                {"spanAttribute": "process_latency", "type": "d", "unit": "ms", "tags": ["tag3"]}
            ]
        }

        response = self.get_success_response(
            self.organization.slug,
            self.project.slug,
            method="post",
            **new_rule_2,
        )

        response = self.get_response(
            self.organization.slug,
            self.project.slug,
            method="get",
        )
        assert response.status_code == 200
        data = response.data
        assert len(data) == 2
        assert data[0]["spanAttribute"] == "count_clicks"
        assert data[1]["spanAttribute"] == "process_latency"

    @with_feature("organizations:custom-metrics-extraction-rule")
    def test_get_pagination(self):
        json_payload = {
            "metricsExtractionRules": [
                {
                    "spanAttribute": f"count_clicks_{i:02d}",
                    "type": "c",
                    "unit": "none",
                    "tags": ["tag1", "tag2", "tag3"],
                }
                for i in range(0, 60)
            ]
        }

        response = self.get_success_response(
            self.organization.slug,
            self.project.slug,
            method="post",
            **json_payload,
        )
        assert response.status_code == 200

        response = self.get_success_response(
            self.organization.slug, self.project.slug, method="get"
        )
        assert response.status_code == 200
        span_attributes = [x["spanAttribute"] for x in response.data]
        assert len(span_attributes) == 25
        assert min(span_attributes) == "count_clicks_00"
        assert max(span_attributes) == "count_clicks_24"
        assert len(set(span_attributes)) == len(span_attributes)

        response = self.get_success_response(
            self.organization.slug, self.project.slug, method="get", cursor="25:1:0"
        )
        assert response.status_code == 200
        span_attributes = [x["spanAttribute"] for x in response.data]
        assert len(span_attributes) == 25
        assert min(span_attributes) == "count_clicks_25"
        assert max(span_attributes) == "count_clicks_49"
        assert len(set(span_attributes)) == len(span_attributes)

        response = self.get_success_response(
            self.organization.slug, self.project.slug, method="get", cursor="25:2:0"
        )
        assert response.status_code == 200
        span_attributes = [x["spanAttribute"] for x in response.data]
        assert len(span_attributes) == 10
        assert min(span_attributes) == "count_clicks_50"
        assert max(span_attributes) == "count_clicks_59"
        assert len(set(span_attributes)) == len(span_attributes)
