import datetime
import uuid
from unittest.mock import patch

from django.urls import reverse

from sentry.models.apitoken import ApiToken
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
