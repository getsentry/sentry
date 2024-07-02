import uuid

from django.urls import reverse

from sentry.models.apitoken import ApiToken
from sentry.silo.base import SiloMode
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers import with_feature
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
            token = ApiToken.objects.create(user=self.user, scope_list=["project:write"])

        response = self.send_put_request(token, self.endpoint)
        assert response.status_code != 403

    @django_db_all
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

            conditions = data[0]["conditions"]
            assert len(conditions) == 2
            assert conditions[0]["value"] == "foo:bar"
            assert conditions[1]["value"] == "baz:faz"

            assert conditions[0]["id"] == 1
            assert conditions[1]["id"] == 2
            assert conditions[0]["mris"] == ["c:custom/span_attribute_1@none"]
            assert conditions[1]["mris"] == ["c:custom/span_attribute_2@none"]

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
        conditions = data[0]["conditions"]
        assert conditions[0]["mris"][0].endswith("millisecond")
        assert conditions[0]["mris"][1].endswith("millisecond")

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
        assert response.status_code == 400

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
    def test_get_pagination(self):
        json_payload = {
            "metricsExtractionRules": [
                {
                    "spanAttribute": f"count_clicks_{i:04d}",
                    "aggregates": ["count", "p50", "p75", "p95", "p99"],
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

        response = self.get_response(
            self.organization.slug,
            self.project.slug,
            method="get",
            **rule,
        )
        assert response.status_code == 200
        assert len(response.data[0]["conditions"]) == 2

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
