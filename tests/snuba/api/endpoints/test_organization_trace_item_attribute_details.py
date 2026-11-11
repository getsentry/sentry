from typing import Any
from uuid import uuid4

from django.urls import reverse
from rest_framework.response import Response

from sentry.testutils.cases import (
    APITestCase,
    BaseSpansTestCase,
    OurLogTestCase,
    SpanTestCase,
)
from sentry.testutils.helpers.datetime import before_now


class OrganizationTraceItemAttributeDetailsEndpointTest(
    BaseSpansTestCase, SpanTestCase, OurLogTestCase, APITestCase
):
    viewname = "sentry-api-0-organization-trace-item-attribute-details"
    feature_flags = {
        "organizations:attribute-management": True,
        "organizations:ourlogs-enabled": True,
        "organizations:visibility-explore-view": True,
    }

    def setUp(self) -> None:
        super().setUp()
        self.login_as(user=self.user)

    def do_request(
        self,
        query: dict[str, Any] | None = None,
        features: dict[str, bool] | None = None,
    ) -> Response:
        with self.feature(self.feature_flags if features is None else features):
            url = reverse(
                self.viewname,
                kwargs={"organization_id_or_slug": self.organization.slug},
            )
            return self.client.get(
                url, {"project": self.project.id, **(query or {})}, format="json"
            )

    def _store_span(self, tags: dict[str, str] | None = None) -> None:
        self.store_segment(
            self.project.id,
            uuid4().hex,
            uuid4().hex,
            organization_id=self.organization.id,
            timestamp=before_now(minutes=10).replace(microsecond=0),
            tags=tags,
        )

    def _store_log(self, attributes: dict[str, dict[str, str]] | None = None) -> None:
        self.store_eap_items(
            [
                self.create_ourlog(
                    organization=self.organization,
                    project=self.project,
                    attributes=attributes,
                )
            ]
        )

    def test_returns_404_when_attribute_management_is_disabled(self) -> None:
        self._store_span({"cart": "a"})

        response = self.do_request(
            query={"attributeName": "cart", "attributeType": "string"},
            features={
                "organizations:ourlogs-enabled": True,
                "organizations:visibility-explore-view": True,
            },
        )

        assert response.status_code == 404, response.content
        assert response.data is None

    def test_returns_400_when_attribute_name_is_missing(self) -> None:
        response = self.do_request(query={"attributeType": "string"})

        assert response.status_code == 400, response.content

    def test_returns_the_attribute_with_its_datasets_when_it_was_stored(self) -> None:
        self._store_span({"shared.attribute": "span"})
        self._store_log({"shared.attribute": {"string_value": "log"}})

        response = self.do_request(
            query={"attributeName": "shared.attribute", "attributeType": "string"}
        )

        assert response.status_code == 200, response.content
        assert response.data == {
            "name": "shared.attribute",
            "attributeType": "string",
            "attributeSource": {"source_type": "user"},
            "datasets": ["spans", "logs"],
            "context": {},
        }

    def test_returns_404_when_only_longer_names_contain_the_attribute_name(self) -> None:
        self._store_span({"cart.id": "a"})

        response = self.do_request(query={"attributeName": "cart", "attributeType": "string"})

        assert response.status_code == 404, response.content

    def test_returns_404_when_sentry_defined_attribute_was_not_stored(self) -> None:
        self._store_span()

        response = self.do_request(
            query={"attributeName": "severity", "attributeType": "string", "dataset": "logs"}
        )

        assert response.status_code == 404, response.content

    def test_returns_always_listed_attribute_when_it_was_not_stored(self) -> None:
        self._store_span()

        response = self.do_request(
            query={"attributeName": "message", "attributeType": "string", "dataset": "logs"}
        )

        assert response.status_code == 200, response.content
        assert response.data["name"] == "message"

    def test_returns_sentry_defined_attribute_when_it_is_stored_under_another_name(
        self,
    ) -> None:
        self._store_log()

        response = self.do_request(
            query={"attributeName": "severity_number", "attributeType": "number", "dataset": "logs"}
        )

        assert response.status_code == 200, response.content
        assert response.data["name"] == "severity_number"
        assert response.data["attributeSource"] == {"source_type": "sentry"}
        assert response.data["datasets"] == ["logs"]

    def test_returns_user_attribute_when_its_name_matches_a_sentry_alias(self) -> None:
        self._store_span({"organization.id": "custom"})

        response = self.do_request(
            query={"attributeName": "organization.id", "attributeType": "string"}
        )

        assert response.status_code == 200, response.content
        assert response.data["name"] == "organization.id"
        assert response.data["attributeSource"] == {"source_type": "user"}
        assert response.data["datasets"] == ["spans"]

    def test_returns_padded_attribute_when_its_name_has_surrounding_whitespace(self) -> None:
        self._store_span({"cart ": "padded", "cart": "plain"})

        response = self.do_request(query={"attributeName": "cart ", "attributeType": "string"})

        assert response.status_code == 200, response.content
        assert response.data["name"] == "cart "

    def test_returns_sentry_attribute_when_a_user_attribute_shares_its_name(self) -> None:
        self._store_span({"severity": "custom"})
        self._store_log()

        response = self.do_request(query={"attributeName": "severity", "attributeType": "string"})

        assert response.status_code == 200, response.content
        assert response.data["name"] == "severity"
        assert response.data["attributeSource"] == {"source_type": "sentry"}
        assert response.data["datasets"] == ["logs"]

    def test_returns_user_attribute_when_user_source_is_requested_for_a_shared_name(
        self,
    ) -> None:
        self._store_span({"severity": "custom"})
        self._store_log()

        response = self.do_request(
            query={
                "attributeName": "severity",
                "attributeType": "string",
                "attributeSource": "user",
            }
        )

        assert response.status_code == 200, response.content
        assert response.data["name"] == "severity"
        assert response.data["attributeSource"] == {"source_type": "user"}
        assert response.data["datasets"] == ["spans"]

    def test_returns_sentry_attribute_when_sentry_source_is_requested_for_a_shared_name(
        self,
    ) -> None:
        self._store_span({"severity": "custom"})
        self._store_log()

        response = self.do_request(
            query={
                "attributeName": "severity",
                "attributeType": "string",
                "attributeSource": "sentry",
            }
        )

        assert response.status_code == 200, response.content
        assert response.data["name"] == "severity"
        assert response.data["attributeSource"] == {"source_type": "sentry"}
        assert response.data["datasets"] == ["logs"]

    def test_returns_404_when_no_attribute_matches_the_requested_source(self) -> None:
        self._store_span({"cart": "a"})

        response = self.do_request(
            query={"attributeName": "cart", "attributeType": "string", "attributeSource": "sentry"}
        )

        assert response.status_code == 404, response.content

    def test_returns_400_when_attribute_source_is_invalid(self) -> None:
        response = self.do_request(
            query={"attributeName": "cart", "attributeType": "string", "attributeSource": "other"}
        )

        assert response.status_code == 400, response.content

    def test_returns_log_message_parameter_when_requested_by_its_public_alias(self) -> None:
        self._store_log({"sentry.message.parameter.0": {"string_value": "laptop"}})

        response = self.do_request(
            query={
                "attributeName": "message.parameter.0",
                "attributeType": "string",
                "dataset": "logs",
            }
        )

        assert response.status_code == 200, response.content
        assert response.data["name"] == "message.parameter.0"

    def test_returns_context_when_the_attribute_has_one(self) -> None:
        self._store_span()

        response = self.do_request(
            query={"attributeName": "project", "attributeType": "string", "dataset": "spans"}
        )

        assert response.status_code == 200, response.content
        assert response.data["name"] == "project"
        assert response.data["context"]["brief"]

    def test_returns_otel_status_in_context_when_the_convention_is_in_otel(self) -> None:
        self._store_span({"http.route": "/users/:id"})

        response = self.do_request(
            query={"attributeName": "http.route", "attributeType": "string", "dataset": "spans"}
        )

        assert response.status_code == 200, response.content
        assert response.data["context"]["isInOtel"] is True

    def test_omits_otel_status_from_context_when_the_convention_is_not_in_otel(self) -> None:
        self._store_span()

        response = self.do_request(
            query={"attributeName": "device.class", "attributeType": "string", "dataset": "spans"}
        )

        assert response.status_code == 200, response.content
        assert response.data["context"]["isConvention"] is True
        assert "isInOtel" not in response.data["context"]

    def test_returns_unit_in_context_when_the_attribute_has_one(self) -> None:
        self.store_segment(
            self.project.id,
            uuid4().hex,
            uuid4().hex,
            organization_id=self.organization.id,
            timestamp=before_now(minutes=10).replace(microsecond=0),
            measurements={"http.response_content_length": 100},
        )

        response = self.do_request(
            query={
                "attributeName": "http.response_content_length",
                "attributeType": "number",
                "dataset": "spans",
            }
        )

        assert response.status_code == 200, response.content
        assert response.data["context"]["unit"] == "byte"
