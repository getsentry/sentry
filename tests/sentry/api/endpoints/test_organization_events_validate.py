from typing import Any
from unittest import mock

import pytest
from django.urls import reverse
from rest_framework.response import Response
from sentry_protos.snuba.v1.endpoint_trace_item_attributes_pb2 import (
    TraceItemAttributeNamesResponse,
)
from sentry_protos.snuba.v1.trace_item_attribute_pb2 import AttributeKey
from sentry_protos.snuba.v1.trace_item_pb2 import AnyValue, ArrayValue

from sentry.testutils.cases import APITestCase, OurLogTestCase, SnubaTestCase, SpanTestCase
from sentry.testutils.helpers.datetime import before_now


class OrganizationEventsValidateEndpointTest(
    APITestCase, SnubaTestCase, SpanTestCase, OurLogTestCase
):
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
        assert dataset_error["name"] == "foobar"
        assert "dataset must be one of" in dataset_error["error"]
        assert not dataset_error["valid"]

    def test_default_dataset_error(self) -> None:
        """Validate matches the behaviour of /events/ where the default dataset is discover, but this is not a RPC
        dataset so the validate endpoint will fail"""
        response = self.do_request(
            {
                "project": [self.project.id],
            }
        )

        assert response.status_code == 200, response.content
        assert response.data["valid"]
        assert len(response.data["dataset"]) == 1
        dataset_error = response.data["dataset"][0]
        assert dataset_error["name"] == "discover"
        assert "This dataset is not compatible with the validate endpoint" in dataset_error["error"]
        assert dataset_error["valid"]

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
            {"error": None, "name": "span.duration", "valid": True, "attrType": "number"}
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
            {"error": None, "name": "project", "valid": True, "attrType": "string"}
        ]

    def test_user_tags_in_storage_for_fields(self) -> None:
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
            {"error": None, "name": "tags[my.custom.tag]", "valid": True, "attrType": "string"},
            {"error": None, "name": "my.custom.tag", "valid": True, "attrType": "string"},
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
                "error": None,
                "name": "my.string.tag",
                "valid": True,
                "attrType": "string",
            },
            {
                "error": None,
                "name": "tags[my.boolean.tag, boolean]",
                "valid": True,
                "attrType": "boolean",
            },
        ]

    def test_array_attribute(self) -> None:
        """Array columns should be typed as ``array`` rather than misclassified as ``number``.

        Array attribute names only surface through Snuba's co-occurring-attrs v2 roll-up,
        gated by the ``use_co_occurring_attrs_v2`` snuba option. It is enabled in production
        but defaults off in the local/CI test Snuba, which therefore never surfaces array
        names. So mock the attribute-names RPC to report the array attribute as present in
        storage and exercise the serialize_type path.
        """
        attribute_name = "data_export.csv_headers"
        column = f"tags[{attribute_name},array]"

        # The only column is an array, so the endpoint only looks up array attributes.
        array_attributes = TraceItemAttributeNamesResponse(
            attributes=[
                TraceItemAttributeNamesResponse.Attribute(
                    name=attribute_name, type=AttributeKey.Type.TYPE_ARRAY_STRING
                )
            ]
        )

        with mock.patch(
            "sentry.utils.snuba_rpc.attribute_names_rpc",
            return_value=array_attributes,
        ):
            response = self.do_request(
                {
                    "project": [self.project.id],
                    "dataset": "spans",
                    "field": [column],
                }
            )

        assert response.status_code == 200, response.content
        assert response.data["valid"]
        assert response.data["field"] == [
            {"error": None, "name": column, "valid": True, "attrType": "array"}
        ]

    @pytest.mark.xfail(
        strict=False,
        reason="Passes once use_co_occurring_attrs_v2 is enabled in the local/CI test Snuba (already on in production).",
    )
    def test_array_attribute_real(self) -> None:
        """Real integration variant of test_array_attribute: store an actual array attribute
        and let Snuba surface it, with no mocking of the attribute-names RPC."""
        attribute_name = "my.array.attr"
        column = f"tags[{attribute_name},array]"

        log = self.create_ourlog(
            organization=self.organization,
            project=self.project,
            timestamp=before_now(minutes=10),
            attributes={
                attribute_name: {
                    "array_value": ArrayValue(
                        values=[AnyValue(string_value="a"), AnyValue(string_value="b")]
                    )
                },
            },
        )
        self.store_eap_items([log])

        with self.feature("organizations:trace-item-array-query-support"):
            response = self.do_request(
                {
                    "project": [self.project.id],
                    "dataset": "logs",
                    "field": [column],
                }
            )

        assert response.status_code == 200, response.content
        assert response.data["valid"]
        assert response.data["field"] == [
            {"error": None, "name": column, "valid": True, "attrType": "array"}
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
            {"error": None, "name": "my.custom.tag", "valid": True, "attrType": "string"},
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

    def test_valid_equation_orderby(self) -> None:
        response = self.do_request(
            {
                "project": [self.project.id],
                "dataset": "spans",
                "field": [
                    "equation|avg(span.duration) * 2",
                    "span.duration",
                ],
                "orderby": ["-equation|avg(span.duration) * 2"],
            }
        )

        assert response.status_code == 200, response.content
        assert response.data["valid"]
        assert response.data["orderby"] == [
            {
                "error": None,
                "name": "-equation|avg(span.duration) * 2",
                "valid": True,
                "attrType": None,
            },
        ]

    def test_invalid_equation_orderby(self) -> None:
        response = self.do_request(
            {
                "project": [self.project.id],
                "dataset": "spans",
                "field": ["span.duration"],
                "orderby": ["-equation|avg(span.duration) * 2"],
            }
        )

        assert response.status_code == 400, response.content
        assert not response.data["valid"]
        assert response.data["orderby"] == [
            {
                "error": "Orderby must also be a selected field",
                "name": "-equation|avg(span.duration) * 2",
                "valid": False,
                "attrType": None,
            },
        ]

    def test_invalid_environment(self) -> None:
        response = self.do_request(
            {
                "project": [self.project.id],
                "dataset": "spans",
                "field": ["span.duration"],
                "environment": ["prediction"],
            }
        )

        assert response.status_code == 400, response.content
        assert not response.data["valid"]
        assert response.data["environment"] == [
            {"error": "Unknown environments selected", "valid": False}
        ]

    def test_valid_environment(self) -> None:
        self.create_environment(self.project, name="production")
        response = self.do_request(
            {
                "project": [self.project.id],
                "dataset": "spans",
                "field": ["span.duration"],
                "environment": ["production"],
            }
        )

        assert response.status_code == 200, response.content
        assert response.data["valid"]

    def test_invalid_query(self) -> None:
        response = self.do_request(
            {
                "project": [self.project.id],
                "dataset": "spans",
                "field": ["span.duration"],
                "query": "project:foo AND",
            }
        )

        assert response.status_code == 400, response.content
        assert not response.data["valid"]
        assert response.data["query"] == {
            "valid": False,
            "error": "Condition is missing on the right side of 'AND' operator",
            "fields": [
                {"attrType": "string", "error": None, "name": "project", "valid": True},
            ],
        }

        response = self.do_request(
            {
                "project": [self.project.id],
                "dataset": "spans",
                "field": ["span.duration"],
                "query": "project:foo AND p90(hello",
            }
        )

        assert response.status_code == 400, response.content
        assert not response.data["valid"]
        assert response.data["query"] == {
            "valid": False,
            "error": "Parse error at ' p90(hello' (column 20). This is commonly caused by unmatched parentheses. Enclose any text in double quotes.",
            "fields": [
                {"attrType": "string", "error": None, "name": "project", "valid": True},
                {"attrType": "string", "error": None, "name": "message", "valid": True},
            ],
        }

        response = self.do_request(
            {
                "project": [self.project.id],
                "dataset": "spans",
                "field": ["span.duration"],
                "query": "span.duration:>hello",
            }
        )

        assert response.status_code == 400, response.content
        assert not response.data["valid"]
        assert response.data["query"] == {
            "valid": False,
            "error": "span.duration: Invalid number: >hello. Expected number then optional k, m, or b suffix (e.g. 500k).",
            "fields": [],
        }

    def test_valid_query(self) -> None:
        response = self.do_request(
            {
                "project": [self.project.id],
                "dataset": "spans",
                "field": ["span.duration"],
                "query": "span.duration:>5s AND (p95(span.duration):>3s or p95(span.duration):<10s)",
            }
        )

        assert response.status_code == 200, response.content
        assert response.data["valid"]
        assert response.data["query"] == {
            "valid": True,
            "error": None,
            "fields": [
                {
                    "error": None,
                    "name": "span.duration",
                    "valid": True,
                    "attrType": "number",
                },
                {
                    "error": None,
                    "name": "p95(span.duration)",
                    "valid": True,
                    "attrType": "number",
                },
            ],
        }

    def test_mixed_validity_query(self) -> None:
        response = self.do_request(
            {
                "project": [self.project.id],
                "dataset": "spans",
                "field": ["span.duration"],
                "query": "span.duration:>5s (hello:world AND (world:hello or or:test))",
            }
        )

        assert response.status_code == 400, response.content
        assert not response.data["valid"]
        assert response.data["query"] == {
            "error": "Unknown attribute",
            "valid": False,
            "fields": [
                {
                    "error": None,
                    "name": "span.duration",
                    "valid": True,
                    "attrType": "number",
                },
                {
                    "error": "Unknown attribute",
                    "name": "hello",
                    "valid": False,
                    "attrType": None,
                },
                {
                    "error": "Unknown attribute",
                    "name": "world",
                    "valid": False,
                    "attrType": None,
                },
                {
                    "error": "Unknown attribute",
                    "name": "or",
                    "valid": False,
                    "attrType": None,
                },
            ],
        }

    def test_user_tags_in_storage_for_query(self) -> None:
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
                "field": ["span.duration"],
                "query": "my.custom.tag:hello",
            }
        )

        assert response.status_code == 200, response.content
        assert response.data["valid"]
        assert response.data["query"] == {
            "error": None,
            "valid": True,
            "fields": [
                {"error": None, "name": "my.custom.tag", "valid": True, "attrType": "string"},
            ],
        }

    def test_invalid_field_in_fields_and_query(self) -> None:
        response = self.do_request(
            {
                "project": [self.project.id],
                "dataset": "spans",
                "field": ["hello", "hello"],
                "query": "hello:world hello:world",
            }
        )

        assert response.status_code == 400, response.content
        assert not response.data["valid"]
        assert response.data["field"] == [
            {
                "error": "Unknown attribute",
                "name": "hello",
                "valid": False,
                "attrType": None,
            },
        ]
        assert response.data["query"] == {
            "error": "Unknown attribute",
            "valid": False,
            "fields": [
                {
                    "error": "Unknown attribute",
                    "name": "hello",
                    "valid": False,
                    "attrType": None,
                },
            ],
        }

    def test_multiple_invalid_issues(self) -> None:
        response = self.do_request(
            {
                "project": [self.project.id],
                "dataset": "spans",
                "field": ["hello", "hello"],
                "query": "hello:world hello:world",
                "orderby": ["world", "-world"],
            }
        )

        assert response.status_code == 400, response.content
        assert not response.data["valid"]
        assert response.data["field"] == [
            {
                "error": "Unknown attribute",
                "name": "hello",
                "valid": False,
                "attrType": None,
            },
        ]
        assert response.data["query"] == {
            "error": "Unknown attribute",
            "valid": False,
            "fields": [
                {
                    "error": "Unknown attribute",
                    "name": "hello",
                    "valid": False,
                    "attrType": None,
                },
            ],
        }
        assert response.data["orderby"] == [
            {
                "error": "Orderby must also be a selected field",
                "name": "world",
                "valid": False,
                "attrType": None,
            },
            {
                "error": "Orderby must also be a selected field",
                "name": "-world",
                "valid": False,
                "attrType": None,
            },
        ]
