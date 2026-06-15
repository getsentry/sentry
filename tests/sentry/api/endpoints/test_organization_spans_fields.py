from operator import itemgetter
from unittest import mock
from uuid import uuid4

from django.urls import reverse
from sentry_conventions.attributes import ATTRIBUTE_NAMES
from sentry_protos.snuba.v1.endpoint_trace_item_attributes_pb2 import (
    TraceItemAttributeNamesResponse,
)
from sentry_protos.snuba.v1.trace_item_attribute_pb2 import AttributeKey

from sentry.testutils.cases import APITestCase, BaseSpansTestCase, SpanTestCase
from sentry.testutils.helpers.datetime import before_now


class OrganizationSpansTagsEndpointTest(BaseSpansTestCase, SpanTestCase, APITestCase):
    view = "sentry-api-0-organization-spans-fields"

    def setUp(self) -> None:
        super().setUp()
        self.login_as(user=self.user)

    def do_request(self, query=None, features=None, **kwargs):
        if features is None:
            features = ["organizations:visibility-explore-view"]

        if query is None:
            query = {}
        query["dataset"] = "spans"
        if "type" not in query:
            query["type"] = "string"

        with self.feature(features):
            return self.client.get(
                reverse(
                    self.view,
                    kwargs={"organization_id_or_slug": self.organization.slug},
                ),
                query,
                format="json",
                **kwargs,
            )

    def test_no_feature(self) -> None:
        response = self.do_request(features=[])
        assert response.status_code == 404, response.data

    def test_no_project(self) -> None:
        response = self.do_request()
        assert response.status_code == 200, response.data
        assert response.data == []

    def test_tags_list_str(self) -> None:
        for tag in ["foo", "bar", "baz"]:
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
                tags={tag: tag},
            )

        for features in [
            None,  # use the default features
            ["organizations:visibility-explore-view"],
        ]:
            response = self.do_request(
                features=features,
                query={"dataset": "spans", "type": "string", "process": 1},
            )
            assert response.status_code == 200, response.data
            assert sorted(
                response.data,
                key=itemgetter("key"),
            ) == sorted(
                [
                    {"key": "bar", "name": "bar"},
                    {"key": "baz", "name": "baz"},
                    {"key": "foo", "name": "foo"},
                    {"key": "span.description", "name": "span.description"},
                    {"key": "transaction", "name": "transaction"},
                    {"key": "project", "name": "project"},
                ],
                key=itemgetter("key"),
            )

    def test_tags_list_nums(self) -> None:
        for tag in [
            "foo",
            "bar",
            "baz",
            "lcp",
            "fcp",
            "http.decoded_response_content_length",
            "http.response_content_length",
            "http.response_transfer_size",
        ]:
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
                measurements={tag: 0},
            )

        for features in [
            None,  # use the default features
            ["organizations:visibility-explore-view"],
        ]:
            response = self.do_request(
                features=features,
                query={"dataset": "spans", "type": "number", "process": 1},
            )
            assert response.status_code == 200, response.data
            assert response.data == [
                {"key": "tags[bar,number]", "name": "bar"},
                {"key": "tags[baz,number]", "name": "baz"},
                {"key": "measurements.fcp", "name": "measurements.fcp"},
                {"key": "tags[foo,number]", "name": "foo"},
                {
                    "key": "http.decoded_response_content_length",
                    "name": "http.decoded_response_content_length",
                },
                {
                    "key": "http.response_content_length",
                    "name": "http.response_content_length",
                },
                {
                    "key": "http.response_transfer_size",
                    "name": "http.response_transfer_size",
                },
                {"key": "measurements.lcp", "name": "measurements.lcp"},
                {"key": "span.duration", "name": "span.duration"},
            ]

    def test_boolean_attributes(self) -> None:
        span1 = self.create_span(start_ts=before_now(days=0, minutes=10))
        span1["data"] = {
            "is_feature_enabled": True,
            "is_debug": False,
        }
        span2 = self.create_span(start_ts=before_now(days=0, minutes=10))
        span2["data"] = {
            "is_feature_enabled": False,
            "is_production": True,
        }
        self.store_spans([span1, span2])

        response = self.do_request(
            query={"dataset": "spans", "type": "boolean"},
        )
        assert response.status_code == 200, response.data
        keys = {item["key"] for item in response.data}
        assert "tags[is_feature_enabled,boolean]" in keys
        assert "tags[is_debug,boolean]" in keys
        assert "tags[is_production,boolean]" in keys

    @mock.patch("sentry.api.endpoints.organization_spans_fields.snuba_rpc.attribute_names_rpc")
    def test_internal_sentry_convention_attributes_are_hidden(self, mock_attribute_names) -> None:
        self.create_span(start_ts=before_now(days=0, minutes=10))
        mock_attribute_names.return_value = TraceItemAttributeNamesResponse(
            attributes=[
                TraceItemAttributeNamesResponse.Attribute(
                    name="public.attribute",
                    type=AttributeKey.Type.TYPE_STRING,
                ),
                TraceItemAttributeNamesResponse.Attribute(
                    name=ATTRIBUTE_NAMES.SENTRY_DSC_ENVIRONMENT,
                    type=AttributeKey.Type.TYPE_STRING,
                ),
            ]
        )

        response = self.do_request()

        assert response.status_code == 200, response.data
        assert response.data == [{"key": "public.attribute", "name": "public.attribute"}]
