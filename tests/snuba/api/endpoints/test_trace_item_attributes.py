from uuid import uuid4

from django.urls import reverse

from sentry.search.events.constants import WILDCARD_OPERATOR_MAP
from sentry.testutils.cases import (
    APITestCase,
    BaseSpansTestCase,
    SpanTestCase,
)
from sentry.testutils.helpers.datetime import before_now


class OrganizationTraceItemQueryValidatorEndpointTest(APITestCase, BaseSpansTestCase, SpanTestCase):
    viewname = "sentry-api-0-organization-trace-item-attributes-validator"
    feature_flags = {
        "organizations:visibility-explore-view": True,
    }

    def setUp(self) -> None:
        super().setUp()
        self.login_as(user=self.user)
        self.project = self.create_project()

    def do_request(self, query=None, features=None, **kwargs):
        if features is None:
            features = self.feature_flags

        with self.feature(features):
            url = reverse(
                self.viewname,
                kwargs={"organization_id_or_slug": self.organization.slug},
            )
            return self.client.get(url, query, format="json", **kwargs)

    def test_no_feature(self):
        response = self.do_request(
            query={"itemType": "spans", "query": "span.description:foo"},
            features={},
        )
        assert response.status_code == 404

    def test_missing_item_type(self):
        response = self.do_request(query={"query": "span.description:foo"})
        assert response.status_code == 400

    def test_missing_query(self):
        response = self.do_request(query={"itemType": "spans"})
        assert response.status_code == 400

    def test_malformed_query(self):
        response = self.do_request(
            query={"itemType": "spans", "query": "span.description:("},
        )
        assert response.status_code == 400
        assert "detail" in response.data

    def test_no_projects(self):
        org = self.create_organization(owner=self.user)
        with self.feature(self.feature_flags):
            url = reverse(
                self.viewname,
                kwargs={"organization_id_or_slug": org.slug},
            )
            response = self.client.get(
                url,
                {"itemType": "spans", "query": "span.description:foo"},
                format="json",
            )
        assert response.status_code == 200
        assert response.data == {"attributes": []}

    def test_known_filter_attributes(self):
        response = self.do_request(
            query={"itemType": "spans", "query": "span.description:foo span.duration:>100"},
        )
        assert response.status_code == 200

        attributes = response.data["attributes"]
        assert len(attributes) == 2

        by_key = {f["key"]: f for f in attributes}
        assert by_key["span.description"]["valid"] is True
        assert by_key["span.description"]["type"] == "string"
        assert by_key["span.duration"]["valid"] is True
        assert by_key["span.duration"]["type"] == "number"

    def test_contains_wildcard_filter(self):
        query = " ".join(
            [
                f"span.op:{WILDCARD_OPERATOR_MAP['contains']}test",
                "span.op:*test*",
            ]
        )

        response = self.do_request(query={"itemType": "spans", "query": query})

        assert response.status_code == 200
        attributes = response.data["attributes"]
        assert len(attributes) == 2
        assert [item["key"] for item in attributes] == ["span.op", "span.op"]
        assert [item["valid"] for item in attributes] == [True, True]
        assert [item["type"] for item in attributes] == ["string", "string"]

    def test_starts_with_wildcard_filter(self):
        query = f"span.op:{WILDCARD_OPERATOR_MAP['starts_with']}test"

        response = self.do_request(query={"itemType": "spans", "query": query})

        assert response.status_code == 200
        assert response.data == {
            "attributes": [{"key": "span.op", "valid": True, "type": "string"}]
        }

    def test_ends_with_wildcard_filter(self):
        query = f"span.op:{WILDCARD_OPERATOR_MAP['ends_with']}test"

        response = self.do_request(query={"itemType": "spans", "query": query})

        assert response.status_code == 200
        assert response.data == {
            "attributes": [{"key": "span.op", "valid": True, "type": "string"}]
        }

    def test_virtual_context_filter(self):
        response = self.do_request(
            query={"itemType": "spans", "query": "project:my-project"},
        )
        assert response.status_code == 200
        assert response.data == {
            "attributes": [{"key": "project", "valid": True, "type": "string"}]
        }

    def test_unknown_filter_not_in_storage(self):
        response = self.do_request(
            query={"itemType": "spans", "query": "my.custom.tag:bar"},
        )
        assert response.status_code == 200
        assert response.data == {
            "attributes": [{"key": "my.custom.tag", "valid": False, "type": None}]
        }

    def test_user_tag_in_storage(self):
        self.store_segment(
            self.project.id,
            uuid4().hex,
            uuid4().hex,
            span_id=uuid4().hex[:16],
            organization_id=self.organization.id,
            parent_span_id=None,
            timestamp=before_now(days=0, minutes=10).replace(microsecond=0),
            transaction="foo",
            duration=100,
            exclusive_time=100,
            tags={"my.custom.tag": "hello"},
        )

        response = self.do_request(
            query={"itemType": "spans", "query": "my.custom.tag:hello"},
        )
        assert response.status_code == 200
        assert response.data == {
            "attributes": [{"key": "my.custom.tag", "valid": True, "type": "string"}]
        }

    def test_aggregate_function_with_known_arg(self):
        response = self.do_request(
            query={"itemType": "spans", "query": "avg(span.duration):>100"},
        )
        assert response.status_code == 200
        assert response.data == {
            "attributes": [{"key": "span.duration", "valid": True, "type": "number"}]
        }

    def test_no_arg_function(self):
        response = self.do_request(
            query={"itemType": "spans", "query": "count():>5"},
        )
        assert response.status_code == 200
        assert response.data == {"attributes": []}

    def test_mixed_filters_and_functions(self):
        response = self.do_request(
            query={
                "itemType": "spans",
                "query": "span.description:foo avg(span.duration):>100 count():>5",
            },
        )
        assert response.status_code == 200
        assert response.data == {
            "attributes": [
                {"key": "span.description", "valid": True, "type": "string"},
                {"key": "span.duration", "valid": True, "type": "number"},
            ]
        }

    def test_parenthesized_expression(self):
        response = self.do_request(
            query={
                "itemType": "spans",
                "query": "(span.description:foo OR span.duration:>100)",
            },
        )
        assert response.status_code == 200
        attributes = response.data["attributes"]
        assert len(attributes) == 2
        by_key = {f["key"]: f for f in attributes}
        assert by_key["span.description"]["valid"] is True
        assert by_key["span.duration"]["valid"] is True

    def test_duplicate_keys_in_query(self):
        response = self.do_request(
            query={
                "itemType": "spans",
                "query": "span.duration:>100 span.duration:<500",
            },
        )
        assert response.status_code == 200
        attributes = response.data["attributes"]
        assert len(attributes) == 2
        for f in attributes:
            assert f["key"] == "span.duration"
            assert f["valid"] is True
            assert f["type"] == "number"

    def test_count_if_with_quoted_string_args(self):
        response = self.do_request(
            query={
                "itemType": "spans",
                "query": 'count_if(span.duration, ">", 100):>5',
            },
        )
        assert response.status_code == 200
        assert response.data == {
            "attributes": [{"key": "span.duration", "valid": True, "type": "number"}]
        }
