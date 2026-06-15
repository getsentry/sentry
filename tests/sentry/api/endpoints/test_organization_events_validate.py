from typing import Any

from django.urls import reverse
from rest_framework.response import Response

from sentry.testutils.cases import APITestCase, SnubaTestCase, SpanTestCase
from sentry.testutils.helpers.datetime import before_now


class OrganizationEventsValidateEndpointTest(APITestCase, SnubaTestCase, SpanTestCase):
    viewname = "sentry-api-0-organization-events-validate"

    def do_request(self, query: Any) -> Response:
        self.login_as(user=self.user)
        return self.client.get(
            reverse(self.viewname, kwargs={"organization_id_or_slug": self.organization.slug}),
            query,
            format="json",
        )

    def test_no_projects(self) -> None:
        response = self.do_request({})

        assert response.status_code == 400, response.content
        assert not response.data["valid"]
        assert response.data["projects"] == [
            {"error": "At least one valid project is required to query", "valid": False}
        ]

    def test_invalid_dataset(self) -> None:
        response = self.do_request(
            {
                "project": [self.project.id],
                "dataset": "foobar",
            }
        )

        assert response.status_code == 400, response.content
        assert not response.data["valid"]
        assert len(response.data["dataset"]) == 1
        dataset_error = response.data["dataset"][0]
        assert "dataset must be one of" in dataset_error["error"]
        assert dataset_error["valid"] is False

    def test_invalid_attributes(self) -> None:
        response = self.do_request(
            {
                "project": [self.project.id],
                "dataset": "spans",
                "field": ["hello", "tags[foobar]", "tags[barbar, number]"],
            }
        )

        assert response.status_code == 400, response.content
        assert not response.data["valid"]
        assert response.data["field"] == [
            {"error": "Unknown attribute", "name": "hello", "valid": False, "attrType": None},
            {
                "error": "Unknown attribute",
                "name": "tags[foobar]",
                "valid": False,
                "attrType": None,
            },
            {
                "error": "Unknown attribute",
                "name": "tags[barbar, number]",
                "valid": False,
                "attrType": None,
            },
        ]

    def test_well_known_attribute(self) -> None:
        response = self.do_request(
            {
                "project": [self.project.id],
                "dataset": "spans",
                "field": ["span.duration"],
            }
        )

        assert response.status_code == 200, response.content
        assert response.data["valid"]
        assert response.data["field"] == [
            {"error": "", "name": "span.duration", "valid": True, "attrType": "number"}
        ]

    def test_virtual_context_attributes(self) -> None:
        response = self.do_request(
            {
                "project": [self.project.id],
                "dataset": "spans",
                "field": ["project"],
            }
        )

        assert response.status_code == 200, response.content
        assert response.data["valid"]
        assert response.data["field"] == [
            {"error": "", "name": "project", "valid": True, "attrType": "string"}
        ]

    def test_user_tags_in_storage(self) -> None:
        self.store_spans(
            [
                self.create_span(
                    {"tags": {"my.custom.tag": "hello"}},
                    start_ts=before_now(days=0, minutes=10),
                ),
            ],
        )

        response = self.do_request(
            {
                "project": [self.project.id],
                "dataset": "spans",
                "field": ["tags[my.custom.tag]", "my.custom.tag"],
            }
        )

        assert response.status_code == 200, response.content
        assert response.data["valid"]
        assert response.data["field"] == [
            {"error": "", "name": "tags[my.custom.tag]", "valid": True, "attrType": "string"},
            {"error": "", "name": "my.custom.tag", "valid": True, "attrType": "string"},
        ]

    def test_mixed_tag_types(self) -> None:
        span = self.create_span(
            start_ts=before_now(days=0, minutes=10),
        )
        span["tags"]["my.string.tag"] = "hi"
        span["tags"]["my.boolean.tag"] = True
        self.store_spans(
            [span],
        )

        response = self.do_request(
            {
                "project": [self.project.id],
                "dataset": "spans",
                "field": ["my.string.tag", "tags[my.boolean.tag, boolean]"],
            }
        )

        assert response.status_code == 200, response.content
        assert response.data["valid"]
        assert response.data["field"] == [
            {
                "error": "",
                "name": "my.string.tag",
                "valid": True,
                "attrType": "string",
            },
            {
                "error": "",
                "name": "tags[my.boolean.tag, boolean]",
                "valid": True,
                "attrType": "boolean",
            },
        ]

    def test_mix_of_validity(self) -> None:
        self.store_spans(
            [
                self.create_span(
                    {"tags": {"my.custom.tag": "hello"}},
                    start_ts=before_now(days=0, minutes=10),
                ),
            ],
        )

        response = self.do_request(
            {
                "project": [self.project.id],
                "dataset": "spans",
                "field": ["my.custom.tag", "my.fake.tag"],
            }
        )

        assert response.status_code == 400, response.content
        assert not response.data["valid"]
        assert response.data["field"] == [
            {"error": "", "name": "my.custom.tag", "valid": True, "attrType": "string"},
            {"error": "Unknown attribute", "name": "my.fake.tag", "valid": False, "attrType": None},
        ]

    def test_private_attribute(self) -> None:
        response = self.do_request(
            {
                "project": [self.project.id],
                "dataset": "spans",
                "field": ["sentry.links"],
            }
        )

        assert response.status_code == 400, response.content
        assert not response.data["valid"]
        assert response.data["field"] == [
            {
                "error": "The field sentry.links is not allowed for this query",
                "name": "sentry.links",
                "valid": False,
                "attrType": None,
            },
        ]

    def test_invalid_function(self) -> None:
        response = self.do_request(
            {
                "project": [self.project.id],
                "dataset": "spans",
                "field": ["count(project)"],
            }
        )

        assert response.status_code == 400, response.content
        assert not response.data["valid"]
        assert len(response.data["field"]) == 1
        field_error = response.data["field"][0]
        assert "project is invalid for parameter 1 in count" in field_error["error"]
        assert field_error["name"] == "count(project)"
        assert not field_error["valid"]
        assert field_error["attrType"] is None

    def test_valid_function(self) -> None:
        response = self.do_request(
            {
                "project": [self.project.id],
                "dataset": "spans",
                "field": ["p95(span.duration)"],
            }
        )

        assert response.status_code == 200, response.content
        assert response.data["valid"]
        assert response.data["field"] == [
            {"error": None, "name": "p95(span.duration)", "valid": True, "attrType": "number"}
        ]

    def test_valid_orderby(self) -> None:
        response = self.do_request(
            {
                "project": [self.project.id],
                "dataset": "spans",
                "field": ["span.duration", "p95(span.duration)"],
                "orderby": ["-span.duration", "p95(span.duration)"],
            }
        )

        assert response.status_code == 200, response.content
        assert response.data["valid"]
        assert response.data["orderby"] == [
            {"error": None, "name": "-span.duration", "valid": True, "attrType": "number"},
            {"error": None, "name": "p95(span.duration)", "valid": True, "attrType": "number"},
        ]

    def test_valid_orderby_alias(self) -> None:
        response = self.do_request(
            {
                "project": [self.project.id],
                "dataset": "spans",
                "field": ["span.duration", "p95(span.duration)"],
                "orderby": ["p95_span_duration"],
            }
        )

        assert response.status_code == 200, response.content
        assert response.data["valid"]
        assert response.data["orderby"] == [
            {"error": None, "name": "p95_span_duration", "valid": True, "attrType": "number"},
        ]

    def test_invalid_orderby(self) -> None:
        response = self.do_request(
            {
                "project": [self.project.id],
                "dataset": "spans",
                "field": ["span.duration"],
                "orderby": ["-spon.doration"],
            }
        )

        assert response.status_code == 400, response.content
        assert not response.data["valid"]
        assert response.data["orderby"] == [
            {
                "error": "Orderby must also be a selected field",
                "name": "-spon.doration",
                "valid": False,
                "attrType": None,
            },
        ]
