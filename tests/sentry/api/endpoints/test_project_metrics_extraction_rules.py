import datetime
import uuid
from unittest.mock import patch

from django.urls import reverse

from sentry.incidents.models.alert_rule import AlertRule
from sentry.models.apitoken import ApiToken
from sentry.models.dashboard_widget import DashboardWidget
from sentry.sentry_metrics.models import SpanAttributeExtractionRuleConfig
from sentry.silo.base import SiloMode
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers import override_options, with_feature
from sentry.testutils.helpers.datetime import freeze_time
from sentry.testutils.pytest.fixtures import django_db_all
from sentry.testutils.silo import assume_test_silo_mode


class ProjectMetricsExtractionEndpointTestCase(APITestCase):
    endpoint = "sentry-api-0-project-metrics-extraction-rules"

    def setUp(self):
        self.login_as(user=self.user)

    @with_feature("organizations:custom-metrics-extraction-rule")
    def send_put_request(self, token, endpoint):
        url = reverse(endpoint, args=(self.project.organization.slug, self.project.slug))
        return self.client.put(url, HTTP_AUTHORIZATION=f"Bearer {token.token}", format="json")

    @django_db_all
    @with_feature("organizations:custom-metrics-extraction-rule")
    def test_permissions(self):
        with assume_test_silo_mode(SiloMode.CONTROL):
            token = ApiToken.objects.create(user=self.user, scope_list=[])

        response = self.send_put_request(token, self.endpoint)
        assert response.status_code == 403

        with assume_test_silo_mode(SiloMode.CONTROL):
            token = ApiToken.objects.create(user=self.user, scope_list=["project:read"])

        response = self.send_put_request(token, self.endpoint)
        assert response.status_code != 403

    @freeze_time("2018-08-24 07:30:00")
    @django_db_all(reset_sequences=True)
    @with_feature("organizations:custom-metrics-extraction-rule")
    def test_create_new_extraction_rule(self):
        new_rule = {
            "metricsExtractionRules": [
                {
                    "spanAttribute": "count_clicks",
                    "aggregates": ["count"],
                    "unit": "none",
                    "tags": ["tag1", "tag2", "tag3"],
                    "conditions": [
                        {"id": str(uuid.uuid4()), "value": "foo:bar"},
                        {"id": str(uuid.uuid4()), "value": "baz:faz"},
                    ],
                }
            ]
        }

        post_response = self.get_response(
            self.organization.slug,
            self.project.slug,
            method="post",
            **new_rule,
        )

        get_response = self.get_response(
            self.organization.slug,
            self.project.slug,
            method="get",
        )
        for response in (post_response, get_response):
            assert response.status_code == 200
            data = response.data
            assert len(data) == 1
            assert data[0]["spanAttribute"] == "count_clicks"
            assert data[0]["aggregates"] == ["count"]
            assert data[0]["unit"] == "none"
            assert set(data[0]["tags"]) == {"tag1", "tag2", "tag3"}
            assert data[0]["createdById"] == self.user.id

            assert data[0]["dateAdded"] == datetime.datetime(
                2018, 8, 24, 7, 30, 0, tzinfo=datetime.UTC
            )
            assert data[0]["dateUpdated"] == datetime.datetime(
                2018, 8, 24, 7, 30, 0, tzinfo=datetime.UTC
            )

            conditions = data[0]["conditions"]
            assert len(conditions) == 2
            assert conditions[0]["value"] == "foo:bar"
            assert conditions[1]["value"] == "baz:faz"

    @django_db_all
    @with_feature("organizations:custom-metrics-extraction-rule")
    @patch(
        "sentry.api.endpoints.project_metrics_extraction_rules.ProjectMetricsExtractionRulesEndpoint.create_audit_entry"
    )
    def test_audit_log_entry_emitted(self, create_audit_entry):
        new_rule = {
            "metricsExtractionRules": [
                {
                    "spanAttribute": "count_clicks",
                    "aggregates": ["count"],
                    "unit": "none",
                    "tags": ["tag1", "tag2", "tag3"],
                    "conditions": [
                        {"value": "foo:bar"},
                        {"value": "baz:faz"},
                    ],
                }
            ]
        }

        self.get_success_response(
            self.organization.slug,
            self.project.slug,
            method="post",
            **new_rule,
        )
        create_audit_entry.assert_called()
        create_audit_entry.reset_mock()

        updated_rule = {
            "metricsExtractionRules": [
                {
                    "spanAttribute": "count_clicks",
                    "aggregates": ["count"],
                    "unit": "none",
                    "tags": ["tag1", "tag2", "tag3"],
                    "conditions": [
                        {"id": 1, "value": "other:condition"},
                    ],
                }
            ]
        }

        self.get_success_response(
            self.organization.slug,
            self.project.slug,
            method="put",
            **updated_rule,
        )
        create_audit_entry.assert_called()
        create_audit_entry.reset_mock()

        self.get_success_response(
            self.organization.slug,
            self.project.slug,
            method="delete",
            **updated_rule,
        )
        create_audit_entry.assert_called()
        create_audit_entry.reset_mock()

    @django_db_all
    @with_feature("organizations:custom-metrics-extraction-rule")
    def test_create_new_extraction_rule_hardcoded_units(self):
        new_rule = {
            "metricsExtractionRules": [
                {
                    "spanAttribute": "span.duration",
                    "aggregates": ["count", "p50", "p75", "p95", "p99"],
                    "unit": "none",
                    "tags": ["tag1", "tag2", "tag3"],
                    "conditions": [
                        {"id": str(uuid.uuid4()), "value": "foo:bar"},
                        {"id": str(uuid.uuid4()), "value": "baz:faz"},
                    ],
                }
            ]
        }

        response = self.get_response(
            self.organization.slug,
            self.project.slug,
            method="post",
            **new_rule,
        )

        assert response.status_code == 200
        data = response.data
        assert len(data) == 1
        assert data[0]["spanAttribute"] == "span.duration"
        assert data[0]["unit"] == "millisecond"
        conditions = data[0]["conditions"]
        assert conditions[0]["mris"][0].endswith("none")
        assert conditions[0]["mris"][1].endswith("none")

    @django_db_all
    @with_feature("organizations:custom-metrics-extraction-rule")
    def test_update_existing_extraction_rule(self):
        original_rule = {
            "metricsExtractionRules": [
                {
                    "spanAttribute": "process_latency",
                    "aggregates": ["count", "p50", "p75", "p95", "p99"],
                    "unit": "none",
                    "tags": ["tag1", "tag2", "tag3"],
                    "conditions": [
                        {"id": str(uuid.uuid4()), "value": "foo:bar"},
                        {"id": str(uuid.uuid4()), "value": "baz:faz"},
                    ],
                }
            ]
        }

        response = self.get_success_response(
            self.organization.slug,
            self.project.slug,
            method="post",
            **original_rule,
        )

        response = self.get_success_response(
            self.organization.slug,
            self.project.slug,
            method="get",
            **original_rule,
        )

        assert response.status_code == 200
        updated_rule = {
            "metricsExtractionRules": [
                {
                    "spanAttribute": "process_latency",
                    "aggregates": ["count"],
                    "unit": "none",
                    "tags": ["tag1", "tag2", "tag3"],
                    "conditions": [
                        {"id": 2, "value": "baz:farzara"},
                        {"id": None, "value": "new:condition"},
                    ],
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
        conditions = data[0]["conditions"]
        assert len(conditions) == 2
        assert {c["value"] for c in conditions} == {"baz:farzara", "new:condition"}

    @django_db_all
    @with_feature("organizations:custom-metrics-extraction-rule")
    def test_delete_existing_extraction_rule(self):
        new_rule = {
            "metricsExtractionRules": [
                {
                    "spanAttribute": "span.duration",
                    "aggregates": ["count", "p50", "p75", "p95", "p99"],
                    "unit": "none",
                    "tags": ["tag1", "tag2", "tag3"],
                    "conditions": [
                        {"id": str(uuid.uuid4()), "value": "foo:bar"},
                        {"id": str(uuid.uuid4()), "value": "baz:faz"},
                    ],
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

        new_rule_2 = {
            "metricsExtractionRules": [
                {
                    "spanAttribute": "process_latency",
                    "aggregates": ["count", "p50", "p75", "p95", "p99"],
                    "unit": "none",
                    "tags": ["tag1", "tag2", "tag3"],
                    "conditions": [
                        {"id": str(uuid.uuid4()), "value": "foo:bar"},
                        {"id": str(uuid.uuid4()), "value": "baz:faz"},
                    ],
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

        response = self.get_response(
            self.organization.slug,
            self.project.slug,
            method="get",
        )
        assert response.status_code == 200
        assert len(response.data) == 2

        response = self.get_response(
            self.organization.slug,
            self.project.slug,
            method="delete",
            **new_rule_2,
        )
        assert response.status_code == 204
        response = self.get_response(
            self.organization.slug,
            self.project.slug,
            method="get",
        )
        assert response.status_code == 200
        assert len(response.data) == 1

    @django_db_all
    @with_feature("organizations:custom-metrics-extraction-rule")
    def test_idempotent_update(self):
        rule = {
            "metricsExtractionRules": [
                {
                    "spanAttribute": "process_latency",
                    "aggregates": ["count", "p50", "p75", "p95", "p99"],
                    "unit": "none",
                    "tags": ["tag1", "tag2", "tag3"],
                    "conditions": [
                        {"id": 1, "value": "foo:bar"},
                        {"id": 2, "value": "baz:faz"},
                    ],
                }
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

    @django_db_all
    @with_feature("organizations:custom-metrics-extraction-rule")
    def test_idempotent_create(self):
        rule = {
            "metricsExtractionRules": [
                {
                    "spanAttribute": "process_latency",
                    "aggregates": ["count", "p50", "p75", "p95", "p99"],
                    "unit": "none",
                    "tags": ["tag1", "tag2", "tag3"],
                    "conditions": [
                        {"id": str(uuid.uuid4()), "value": "foo:bar"},
                        {"id": str(uuid.uuid4()), "value": "baz:faz"},
                    ],
                }
            ]
        }

        response = self.get_success_response(
            self.organization.slug,
            self.project.slug,
            method="post",
            **rule,
        )
        assert response.status_code == 200

        response = self.get_response(
            self.organization.slug,
            self.project.slug,
            method="post",
            **rule,
        )
        assert response.status_code == 409

    @django_db_all
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

    @django_db_all
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

    @django_db_all
    @with_feature("organizations:custom-metrics-extraction-rule")
    @override_options({"metric_extraction.max_span_attribute_specs": 5000})
    def test_get_pagination(self):
        json_payload = {
            "metricsExtractionRules": [
                {
                    "spanAttribute": f"count_clicks_{i:04d}",
                    "aggregates": ["count"],
                    "unit": "none",
                    "tags": ["tag1", "tag2", "tag3"],
                    "conditions": [
                        {"id": str(uuid.uuid4()), "value": "foo:bar"},
                        {"id": str(uuid.uuid4()), "value": "baz:faz"},
                    ],
                }
                for i in range(0, 2050)
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
        assert len(span_attributes) == 1000
        assert min(span_attributes) == "count_clicks_0000"
        assert max(span_attributes) == "count_clicks_0999"
        assert len(set(span_attributes)) == len(span_attributes)

        response = self.get_success_response(
            self.organization.slug, self.project.slug, method="get", cursor="1000:1:0"
        )
        assert response.status_code == 200
        span_attributes = [x["spanAttribute"] for x in response.data]
        assert len(span_attributes) == 1000
        assert min(span_attributes) == "count_clicks_1000"
        assert max(span_attributes) == "count_clicks_1999"
        assert len(set(span_attributes)) == len(span_attributes)

        response = self.get_success_response(
            self.organization.slug, self.project.slug, method="get", cursor="1000:2:0"
        )
        assert response.status_code == 200
        span_attributes = [x["spanAttribute"] for x in response.data]
        assert len(span_attributes) == 50
        assert min(span_attributes) == "count_clicks_2000"
        assert max(span_attributes) == "count_clicks_2049"
        assert len(set(span_attributes)) == len(span_attributes)

    @django_db_all
    @with_feature("organizations:custom-metrics-extraction-rule")
    def test_null_validation(self):
        new_rule = {
            "spanAttribute": None,
            "aggregates": ["count"],
            "unit": "none",
            "tags": ["tag1", "tag2", "tag3"],
            "conditions": [
                {"id": str(uuid.uuid4()), "value": "foo:bar"},
                {"id": str(uuid.uuid4()), "value": "baz:faz"},
            ],
        }

        response = self.get_response(
            self.organization.slug,
            self.project.slug,
            method="post",
            **new_rule,
        )

        assert response.status_code == 400

        new_rule = {
            "spanAttribute": "count_stuff",
            "aggregates": None,
            "unit": "none",
            "tags": ["tag1", "tag2", "tag3"],
            "conditions": [
                {"id": str(uuid.uuid4()), "value": "foo:bar"},
                {"id": str(uuid.uuid4()), "value": "baz:faz"},
            ],
        }

        response = self.get_response(
            self.organization.slug,
            self.project.slug,
            method="post",
            **new_rule,
        )

        assert response.status_code == 400

    @django_db_all
    @with_feature("organizations:custom-metrics-extraction-rule")
    def test_post_without_unit(self):
        new_rule = {
            "metricsExtractionRules": [
                {
                    "spanAttribute": "my_span_attribute",
                    "aggregates": ["count"],
                    "unit": None,
                    "tags": ["tag1", "tag2", "tag3"],
                    "conditions": [
                        {"id": str(uuid.uuid4()), "value": "foo:bar"},
                        {"id": str(uuid.uuid4()), "value": "baz:faz"},
                    ],
                }
            ]
        }

        response = self.get_response(
            self.organization.slug,
            self.project.slug,
            method="post",
            **new_rule,
        )

        assert response.status_code == 200
        assert len(response.data) == 1
        assert response.data[0]["unit"] == "none"

    @django_db_all
    @with_feature("organizations:custom-metrics-extraction-rule")
    def test_put_transaction(self):
        rule = {
            "metricsExtractionRules": [
                {
                    "spanAttribute": "my_span_attribute",
                    "aggregates": ["count"],
                    "unit": "none",
                    "tags": ["tag1", "tag2", "tag3"],
                    "conditions": [
                        {"id": str(uuid.uuid4()), "value": "foo:bar"},
                        {"id": str(uuid.uuid4()), "value": "baz:faz"},
                    ],
                }
            ]
        }

        response = self.get_response(
            self.organization.slug,
            self.project.slug,
            method="post",
            **rule,
        )

        assert response.status_code == 200

        rule = {
            "metricsExtractionRules": [
                {
                    "spanAttribute": "my_span_attribute",
                    "aggregates": ["count"],
                    "unit": "none",
                    "tags": ["tag1", "tag2", "tag3"],
                }
            ]
        }

        response = self.get_response(
            self.organization.slug,
            self.project.slug,
            method="put",
            **rule,
        )

        assert response.status_code == 400

        rule = {
            "metricsExtractionRules": [
                {
                    "spanAttribute": "my_span_attribute",
                    "aggregates": ["count"],
                    "unit": "none",
                    "tags": ["tag1", "tag2", "tag3"],
                    "conditions": [{"value": "new:condition"}],
                }
            ]
        }

        response = self.get_response(
            self.organization.slug,
            self.project.slug,
            method="put",
            **rule,
        )

        assert response.status_code == 200

        response = self.get_response(
            self.organization.slug,
            self.project.slug,
            method="get",
            **rule,
        )
        assert response.status_code == 200
        assert len(response.data[0]["conditions"]) == 1
        assert response.data[0]["conditions"][0]["value"] == "new:condition"
        assert response.data[0]["conditions"][0]["id"] is not None

    @django_db_all
    @with_feature("organizations:custom-metrics-extraction-rule")
    def test_post_transaction(self):
        rule = {
            "metricsExtractionRules": [
                {
                    "spanAttribute": "my_span_attribute",
                    "aggregates": ["count"],
                    "unit": "none",
                    "tags": ["tag1", "tag2", "tag3"],
                    "conditions": [
                        {"id": str(uuid.uuid4()), "value": "foo:bar"},
                        {"id": str(uuid.uuid4()), "value": "baz:faz"},
                    ],
                },
                {
                    "aggregates": ["count"],
                    "unit": "none",
                    "tags": ["tag1", "tag2", "tag3"],
                    "conditions": [
                        {"id": str(uuid.uuid4()), "value": "foo:bar"},
                        {"id": str(uuid.uuid4()), "value": "baz:faz"},
                    ],
                },
            ]
        }

        response = self.get_response(
            self.organization.slug,
            self.project.slug,
            method="post",
            **rule,
        )

        assert response.status_code == 400

        response = self.get_response(
            self.organization.slug,
            self.project.slug,
            method="get",
            **rule,
        )
        assert response.status_code == 200
        assert len(response.data) == 0

    @django_db_all
    @with_feature("organizations:custom-metrics-extraction-rule")
    @override_options({"metric_extraction.max_span_attribute_specs": 1})
    def test_specs_over_limit(self):

        new_rule = {
            "metricsExtractionRules": [
                {
                    "spanAttribute": "my_span_attribute",
                    "aggregates": ["count"],
                    "unit": None,
                    "tags": ["tag1", "tag2", "tag3"],
                    "conditions": [
                        {"id": str(uuid.uuid4()), "value": "foo:bar"},
                        {"id": str(uuid.uuid4()), "value": "baz:faz"},
                    ],
                }
            ]
        }

        response = self.get_response(
            self.organization.slug,
            self.project.slug,
            method="post",
            **new_rule,
        )

        assert response.status_code == 400
        assert response.data["detail"] == "Total number of rules exceeds the limit of 1."

    @django_db_all
    @with_feature("organizations:custom-metrics-extraction-rule")
    def test_query_filter_rules(self):
        for i, span_attribute in zip(range(0, 3), ("count_clicks", "some_span", "count_views")):
            self.create_span_attribute_extraction_config(
                dictionary={
                    "spanAttribute": span_attribute,
                    "aggregates": ["count", "p50", "p75", "p95", "p99"],
                    "unit": "none",
                    "tags": [f"tag{num}" for num in range(0, i)],
                    "conditions": [
                        {"value": f"foo:bar{i}"},
                    ],
                },
                user_id=self.user.id,
                project=self.project,
            )

        response = self.get_response(
            self.organization.slug,
            self.project.slug,
            method="get",
            query="count",
        )

        assert response.status_code == 200
        data = response.data
        assert len(data) == 2
        assert {el["spanAttribute"] for el in data} == {"count_clicks", "count_views"}

        response = self.get_response(
            self.organization.slug,
            self.project.slug,
            method="get",
            query="span",
        )

        assert response.status_code == 200
        data = response.data
        assert len(data) == 1
        assert {el["spanAttribute"] for el in data} == {"some_span"}

    @django_db_all
    @with_feature("organizations:custom-metrics-extraction-rule")
    def test_alerts_and_widgets_are_deleted_with_extraction_rules(self):
        config = {
            "spanAttribute": "count_clicks",
            "aggregates": ["count", "p50", "p75", "p95", "p99"],
            "unit": "none",
            "tags": ["tag1", "tag2"],
            "conditions": [
                {"value": "foo:bar"},
            ],
        }
        span_attribute_extraction_rule = self.create_span_attribute_extraction_config(
            dictionary=config, user_id=self.user.id, project=self.project
        )
        condition1 = span_attribute_extraction_rule.conditions.first()
        condition_mris = condition1.generate_mris()
        mri1 = condition_mris[0]
        mri2 = condition_mris[1]
        alert_rule1 = self.create_alert_rule(organization=self.organization, aggregate=mri1)
        alert_rule2 = self.create_alert_rule(organization=self.organization, aggregate=mri2)
        dashboard = self.create_dashboard(organization=self.organization)
        dashboard_widget1 = self.create_dashboard_widget(dashboard=dashboard, order=0)
        self.create_dashboard_widget_query(widget=dashboard_widget1, aggregates=[mri1], order=1)
        dashboard_widget2 = self.create_dashboard_widget(dashboard=dashboard, order=2)
        self.create_dashboard_widget_query(widget=dashboard_widget2, aggregates=[mri2], order=2)

        updated_rule = {
            "metricsExtractionRules": [
                {
                    "spanAttribute": "count_clicks",
                    "aggregates": ["count"],
                    "unit": "none",
                    "tags": ["tag1", "tag2", "tag3"],
                    "conditions": [
                        {"id": 1, "value": "other:condition"},
                    ],
                }
            ]
        }

        self.get_success_response(
            self.organization.slug,
            self.project.slug,
            method="delete",
            **updated_rule,
        )

        assert not SpanAttributeExtractionRuleConfig.objects.filter(
            project=self.project, span_attribute="count_clicks"
        ).exists()

        assert not AlertRule.objects.filter(id=alert_rule1.id).exists()
        assert not AlertRule.objects.filter(id=alert_rule2.id).exists()
        assert not DashboardWidget.objects.filter(id=dashboard_widget1.id).exists()
        assert not DashboardWidget.objects.filter(id=dashboard_widget2.id).exists()

    @django_db_all
    @with_feature("organizations:custom-metrics-extraction-rule")
    def test_alerts_and_widgets_connected_to_other_extraction_rules_are_not_affected(self):
        # Create a rule that will be deleted
        config1 = {
            "spanAttribute": "count_clicks",
            "aggregates": ["count", "p50", "p75", "p95", "p99"],
            "unit": "none",
            "tags": ["tag1", "tag2"],
            "conditions": [
                {"value": "foo:bar"},
            ],
        }
        span_attribute_extraction_rule1 = self.create_span_attribute_extraction_config(
            dictionary=config1, user_id=self.user.id, project=self.project
        )
        condition1 = span_attribute_extraction_rule1.conditions.first()
        condition_mris1 = condition1.generate_mris()
        mri1 = condition_mris1[0]
        mri2 = condition_mris1[1]
        self.create_alert_rule(organization=self.organization, aggregate=mri1)
        self.create_alert_rule(organization=self.organization, aggregate=mri2)
        dashboard = self.create_dashboard(organization=self.organization)
        dashboard_widget1 = self.create_dashboard_widget(dashboard=dashboard, order=0)
        self.create_dashboard_widget_query(widget=dashboard_widget1, aggregates=[mri1], order=1)
        dashboard_widget2 = self.create_dashboard_widget(dashboard=dashboard, order=2)
        self.create_dashboard_widget_query(widget=dashboard_widget2, aggregates=[mri2], order=2)

        # Create a rule that will not be deleted
        config2 = {
            "spanAttribute": "count_views",
            "aggregates": ["count", "p50", "p75", "p95", "p99"],
            "unit": "none",
            "tags": ["tag1", "tag2"],
            "conditions": [
                {"value": "foo:bar"},
            ],
        }
        span_attribute_extraction_rule2 = self.create_span_attribute_extraction_config(
            dictionary=config2, user_id=self.user.id, project=self.project
        )
        condition2 = span_attribute_extraction_rule2.conditions.first()
        condition_mris2 = condition2.generate_mris()
        mri3 = condition_mris2[0]
        mri4 = condition_mris2[1]
        alert_rule3 = self.create_alert_rule(organization=self.organization, aggregate=mri3)
        alert_rule4 = self.create_alert_rule(organization=self.organization, aggregate=mri4)
        dashboard_widget3 = self.create_dashboard_widget(dashboard=dashboard, order=3)

        updated_rule = {
            "metricsExtractionRules": [
                {
                    "spanAttribute": "count_clicks",
                    "aggregates": ["count"],
                    "unit": "none",
                    "tags": ["tag1", "tag2", "tag3"],
                    "conditions": [
                        {"id": 1, "value": "other:condition"},
                    ],
                }
            ]
        }

        self.get_success_response(
            self.organization.slug,
            self.project.slug,
            method="delete",
            **updated_rule,
        )

        assert SpanAttributeExtractionRuleConfig.objects.filter(
            project=self.project, span_attribute="count_views"
        ).exists()
        assert AlertRule.objects.filter(id=alert_rule3.id).exists()
        assert AlertRule.objects.filter(id=alert_rule4.id).exists()
        assert DashboardWidget.objects.filter(id=dashboard_widget3.id).exists()
