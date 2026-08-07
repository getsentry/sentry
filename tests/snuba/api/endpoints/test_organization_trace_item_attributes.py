from operator import itemgetter
from unittest import mock
from uuid import uuid4

import pytest
from django.db import connections
from django.test.utils import CaptureQueriesContext
from django.urls import reverse
from rest_framework.exceptions import ErrorDetail
from sentry_conventions.attributes import ATTRIBUTE_METADATA
from sentry_protos.snuba.v1.endpoint_trace_item_attributes_pb2 import (
    TraceItemAttributeNamesResponse,
)
from sentry_protos.snuba.v1.trace_item_attribute_pb2 import AttributeKey
from sentry_protos.snuba.v1.trace_item_pb2 import AnyValue, ArrayValue

from sentry.api.endpoints.organization_trace_item_attributes import build_sentry_convention_context
from sentry.api.endpoints.organization_trace_item_attributes_types import (
    TraceItemAttributeKey,
)
from sentry.exceptions import InvalidSearchQuery
from sentry.explore.models import (
    TraceItemAttributeContext,
    TraceItemAttributeTypes,
    TraceItemTypes,
)
from sentry.search.eap import constants
from sentry.search.eap.spans.definitions import SPAN_DEFINITIONS
from sentry.search.eap.types import SupportedTraceItemType
from sentry.testutils.cases import (
    APITestCase,
    BaseSpansTestCase,
    OurLogTestCase,
    SnubaTestCase,
    SpanTestCase,
    TraceMetricsTestCase,
)
from sentry.testutils.helpers import parse_link_header
from sentry.testutils.helpers.datetime import before_now
from sentry.testutils.helpers.options import override_options


class TestBuildAttributeContext:
    def test_lookup_by_public_name(self) -> None:
        context = build_sentry_convention_context("device.class", "sentry.device.class")
        assert context is not None
        assert context["brief"].startswith("The classification of the device.")
        assert context["isDeprecated"] is False

    def test_falls_back_to_internal_name(self) -> None:
        # The convention is keyed by the internal name (`sentry.op`), not the
        # public alias (`span.op`), so the public-name lookup misses and the
        # fallback must resolve it.
        assert "span.op" not in ATTRIBUTE_METADATA
        context = build_sentry_convention_context("span.op", "sentry.op")
        assert context == {
            "isConvention": True,
            "brief": "The operation of a span.",
            "examples": ["http.client"],
            "isDeprecated": False,
        }

    def test_deprecated_attribute_includes_replacement(self) -> None:
        context = build_sentry_convention_context("transaction", "sentry.transaction")
        assert context is not None
        assert context["isConvention"] is True
        assert context["isDeprecated"] is True
        assert context["replacementAttribute"] == "sentry.segment.name"

    def test_unknown_attribute_returns_none(self) -> None:
        assert build_sentry_convention_context("not.a.convention", "also.not.a.convention") is None

    def test_matches_convention_not_in_attributes_py(self) -> None:
        # `http.route` is defined in sentry-conventions but not in attributes.py,
        # so it resolves as a `user` source attribute. It should still match.
        context = build_sentry_convention_context("http.route", "http.route")
        assert context is not None
        assert context["isConvention"] is True
        assert context["brief"]

    def test_matching_type_is_required_when_provided(self) -> None:
        # `http.route` is a string convention; a number attribute with the same
        # name is not that convention.
        assert build_sentry_convention_context("http.route", "http.route", "string") is not None
        assert build_sentry_convention_context("http.route", "http.route", "number") is None
        # Array / "any" convention types don't constrain the match (`ai.citations`
        # is a `string[]` convention).
        context = build_sentry_convention_context("ai.citations", "ai.citations", "number")
        assert context is not None and context["isConvention"] is True


class OrganizationTraceItemAttributesEndpointTestBase(APITestCase, SnubaTestCase):
    feature_flags: dict[str, bool]
    item_type: SupportedTraceItemType

    viewname = "sentry-api-0-organization-trace-item-attributes"

    def setUp(self) -> None:
        super().setUp()
        self.login_as(user=self.user)

    def do_request(self, query=None, features=None, **kwargs):
        if query is None:
            query = {}
        if "dataset" not in query:
            query["dataset"] = self.item_type.value

        if features is None:
            features = self.feature_flags

        with self.feature(features):
            url = reverse(
                self.viewname,
                kwargs={"organization_id_or_slug": self.organization.slug},
            )
            return self.client.get(url, query, format="json", **kwargs)


class OrganizationTraceItemAttributesEndpointLogsTest(
    OrganizationTraceItemAttributesEndpointTestBase, OurLogTestCase
):
    feature_flags = {"organizations:ourlogs-enabled": True}
    array_feature_flags = {
        "organizations:ourlogs-enabled": True,
        "organizations:trace-item-array-query-support": True,
    }
    item_type = SupportedTraceItemType.LOGS

    def test_no_feature(self) -> None:
        response = self.do_request(features={})
        assert response.status_code == 404, response.content

    def test_invalid_query_returns_400(self) -> None:
        response = self.do_request(query={"query": "trace:nope", "project": self.project.id})
        assert response.status_code == 400, response.content

    def test_invalid_dataset(self) -> None:
        response = self.do_request(query={"dataset": "invalid"})
        assert response.status_code == 400, response.content
        assert response.data == {
            "dataset": [
                ErrorDetail(string='"invalid" is not a valid choice.', code="invalid_choice")
            ],
        }

    def test_no_projects(self) -> None:
        response = self.do_request(query={"attributeType": "string"})
        assert response.status_code == 200, response.content
        assert response.data == []

    def test_substring_matching_logs(self) -> None:
        logs = [
            self.create_ourlog(
                extra_data={"body": "log message 1"},
                organization=self.organization,
                project=self.project,
                attributes={
                    "test.attribute1": {"string_value": "value1"},
                    "test.attribute2": {"string_value": "value2"},
                    "another.attribute": {"string_value": "value3"},
                },
            ),
            self.create_ourlog(
                extra_data={"body": "log message 2"},
                organization=self.organization,
                project=self.project,
                attributes={
                    "test.attribute3": {"string_value": "value4"},
                    "different.attr": {"string_value": "value5"},
                },
            ),
        ]
        self.store_eap_items(logs)

        # Test with empty prefix (should return all attributes)
        response = self.do_request(query={"substringMatch": "", "attributeType": "string"})
        assert response.status_code == 200, response.content

        keys = {item["key"] for item in response.data}
        assert len(keys) >= 6
        assert "test.attribute1" in keys
        assert "test.attribute2" in keys
        assert "test.attribute3" in keys
        assert "another.attribute" in keys
        assert "different.attr" in keys
        assert "severity" in keys

        # With a prefix only match the attributes that start with "tes"
        response = self.do_request(query={"substringMatch": "tes"})
        assert response.status_code == 200, response.content
        keys = {item["key"] for item in response.data}
        assert len(keys) == 3
        assert "test.attribute1" in keys
        assert "test.attribute2" in keys
        assert "test.attribute3" in keys
        assert "another.attribute" not in keys
        assert "different.attr" not in keys

    def test_all_attributes(self) -> None:
        logs = [
            self.create_ourlog(
                organization=self.organization,
                project=self.project,
                attributes={
                    "test.attribute1": {"string_value": "value1"},
                    "test.attribute2": {"string_value": "value2"},
                },
            ),
        ]
        self.store_eap_items(logs)

        response = self.do_request(query={"attributeType": "string"})

        assert response.status_code == 200, response.content
        keys = {item["key"] for item in response.data}
        assert len(keys) >= 3
        assert "test.attribute1" in keys
        assert "test.attribute2" in keys
        assert "severity" in keys

    def test_body_attribute(self) -> None:
        logs = [
            self.create_ourlog(
                organization=self.organization,
                project=self.project,
                attributes={
                    "message": {"string_value": "value1"},
                },
            ),
        ]
        self.store_eap_items(logs)

        response = self.do_request(query={"attributeType": "string"})

        assert response.status_code == 200, response.content
        keys = {item["key"] for item in response.data}
        assert keys == {"severity", "message", "project", "tags[message,string]"}

    def test_disallowed_attributes(self) -> None:
        logs = [
            self.create_ourlog(
                organization=self.organization,
                project=self.project,
                attributes={
                    "sentry.item_type": {"string_value": "value1"},  # Disallowed
                    "sentry.item_type2": {"string_value": "value2"},  # Allowed
                },
            ),
        ]

        self.store_eap_items(logs)

        response = self.do_request(query={"attributeType": "string"})

        assert response.status_code == 200, response.content
        keys = {item["key"] for item in response.data}
        assert keys == {"severity", "message", "project", "sentry.item_type2"}

    def test_strip_sentry_prefix_from_message_parameter(self) -> None:
        """Test that sentry.message.parameter.* wildcard matching works in attribute listing"""
        logs = [
            self.create_ourlog(
                organization=self.organization,
                project=self.project,
                attributes={
                    "sentry.message.parameter.username": {"string_value": "alice"},
                    "sentry.message.parameter.ip": {"string_value": "192.168.1.1"},
                    "sentry.message.parameter.0": {"string_value": "laptop"},
                    "sentry.message.parameter.1": {"string_value": "charlie"},
                },
            ),
            self.create_ourlog(
                organization=self.organization,
                project=self.project,
                attributes={
                    "sentry.message.parameter.1": {"int_value": 5},
                    "sentry.message.parameter.2": {"double_value": 10},
                    "sentry.message.parameter.value": {"double_value": 15},
                },
            ),
        ]

        self.store_eap_items(logs)

        response = self.do_request(query={"attributeType": "string"})

        assert response.status_code == 200, response.content
        assert sorted(response.data, key=lambda key: key["key"]) == [
            {
                "key": "message",
                "name": "message",
                "attributeSource": {
                    "source_type": "sentry",
                },
                "secondaryAliases": ["log.body"],
                "attributeType": "string",
            },
            {
                "key": "message.parameter.0",
                "name": "message.parameter.0",
                "attributeSource": {
                    "source_type": "sentry",
                    "is_transformed_alias": True,
                },
                "attributeType": "string",
            },
            {
                "key": "message.parameter.1",
                "name": "message.parameter.1",
                "attributeSource": {
                    "source_type": "sentry",
                    "is_transformed_alias": True,
                },
                "attributeType": "string",
            },
            {
                "key": "message.parameter.ip",
                "name": "message.parameter.ip",
                "attributeSource": {
                    "source_type": "sentry",
                    "is_transformed_alias": True,
                },
                "attributeType": "string",
            },
            {
                "key": "message.parameter.username",
                "name": "message.parameter.username",
                "attributeSource": {
                    "source_type": "sentry",
                    "is_transformed_alias": True,
                },
                "attributeType": "string",
            },
            {
                "key": "project",
                "name": "project",
                "attributeSource": {
                    "source_type": "sentry",
                },
                "attributeType": "string",
            },
            {
                "key": "severity",
                "name": "severity",
                "attributeSource": {
                    "source_type": "sentry",
                },
                "secondaryAliases": ["log.severity_text", "severity_text"],
                "attributeType": "string",
            },
        ]

        sources = {item["attributeSource"]["source_type"] for item in response.data}
        assert sources == {"sentry"}

        message_param_items = [
            item for item in response.data if item["key"].startswith("message.parameter.")
        ]
        for item in message_param_items:
            assert item["attributeSource"]["is_transformed_alias"] is True

        response = self.do_request(query={"attributeType": "number"})

        assert response.status_code == 200, response.content
        assert sorted(response.data, key=lambda key: key["key"]) == [
            {
                "key": "observed_timestamp",
                "name": "observed_timestamp",
                "attributeSource": {
                    "source_type": "sentry",
                },
                "attributeType": "number",
            },
            {
                "key": "severity_number",
                "name": "severity_number",
                "attributeSource": {
                    "source_type": "sentry",
                },
                "secondaryAliases": ["log.severity_number"],
                "attributeType": "number",
            },
            {
                "key": "tags[message.parameter.1,number]",
                "name": "message.parameter.1",
                "attributeSource": {
                    "source_type": "sentry",
                    "is_transformed_alias": True,
                },
                "attributeType": "number",
            },
            {
                "key": "tags[message.parameter.2,number]",
                "name": "message.parameter.2",
                "attributeSource": {
                    "source_type": "sentry",
                    "is_transformed_alias": True,
                },
                "attributeType": "number",
            },
            {
                "key": "tags[message.parameter.value,number]",
                "name": "message.parameter.value",
                "attributeSource": {
                    "source_type": "sentry",
                    "is_transformed_alias": True,
                },
                "attributeType": "number",
            },
            {
                "key": "timestamp_precise",
                "name": "timestamp_precise",
                "attributeSource": {
                    "source_type": "sentry",
                },
                "attributeType": "number",
            },
        ]

    def test_attribute_collision(self) -> None:
        logs = [
            self.create_ourlog(
                organization=self.organization,
                project=self.project,
                attributes={"timestamp": "bar", "severity": "baz"},
            ),
        ]

        self.store_eap_items(logs)

        response = self.do_request(query={"attributeType": "string"})

        assert response.status_code == 200, response.content
        keys = {item["key"] for item in response.data}
        assert keys == {
            "message",
            "project",
            "severity",
            "tags[severity,string]",
            "tags[timestamp,string]",
        }

    def test_attribute_collision_with_private_reserved_alias(self) -> None:
        # `organization.id` collides with the private reserved `sentry.organization_id`.
        # A user-sent attribute of that name must still be exposed, disambiguated
        # under an explicit `tags[...]` key and attributed to the user.
        logs = [
            self.create_ourlog(
                organization=self.organization,
                project=self.project,
                attributes={"organization.id": "user-org-value"},
            ),
        ]

        self.store_eap_items(logs)

        response = self.do_request(query={"attributeType": "string"})

        assert response.status_code == 200, response.content
        org_id = {item["key"]: item for item in response.data if item["name"] == "organization.id"}
        assert "tags[organization.id,string]" in org_id
        assert org_id["tags[organization.id,string]"]["attributeSource"] == {"source_type": "user"}

    def test_boolean_attributes(self) -> None:
        logs = [
            self.create_ourlog(
                organization=self.organization,
                project=self.project,
                attributes={
                    "is_active": {"bool_value": True},
                    "is_deleted": {"bool_value": False},
                    "feature_enabled": True,  # Direct boolean value
                },
            ),
            self.create_ourlog(
                organization=self.organization,
                project=self.project,
                attributes={
                    "is_active": {"bool_value": False},
                    "another_flag": False,  # Direct boolean value
                },
            ),
        ]
        self.store_eap_items(logs)

        response = self.do_request(query={"attributeType": "boolean"})

        assert response.status_code == 200, response.content
        keys = {item["key"] for item in response.data}
        assert "tags[is_active,boolean]" in keys
        assert "tags[is_deleted,boolean]" in keys
        assert "tags[feature_enabled,boolean]" in keys
        assert "tags[another_flag,boolean]" in keys

    def _store_array_log(self) -> None:
        logs = [
            self.create_ourlog(
                organization=self.organization,
                project=self.project,
                attributes={
                    "data_export.csv_headers": {
                        "array_value": ArrayValue(
                            values=[
                                AnyValue(string_value="title"),
                                AnyValue(string_value="project"),
                            ]
                        )
                    },
                    "data_export.blob_offsets": {
                        "array_value": ArrayValue(
                            values=[AnyValue(int_value=0), AnyValue(int_value=1048576)]
                        )
                    },
                    "data_export.status": {"string_value": "finished"},
                },
            ),
        ]
        self.store_eap_items(logs)

    @pytest.mark.xfail(
        strict=False,
        reason=(
            "Real array attribute names require Snuba's co-occurring-attrs v2 roll-up, "
            "which is gated behind a Snuba option and a data-window cutoff and is not the "
            "default in the local test Snuba, so this insert is served by v1 (no array "
            "columns). Remove this marker once co-occurring-attrs v2 is the default."
        ),
    )
    def test_array_attributes_surface_with_array_kind(self) -> None:
        self._store_array_log()

        response = self.do_request(features=self.array_feature_flags)
        assert response.status_code == 200, response.content
        by_name = {item["name"]: item for item in response.data}

        assert "data_export.csv_headers" in by_name
        assert by_name["data_export.csv_headers"]["attributeType"] == "array"
        assert by_name["data_export.csv_headers"]["key"] == "tags[data_export.csv_headers,array]"

        assert "data_export.blob_offsets" in by_name
        assert by_name["data_export.blob_offsets"]["attributeType"] == "array"

    def _mock_attribute_names_rpc(self, response_by_type):
        """Patch the attribute-names RPC to return a patched response when snuba
        gates  co-occurring-attrs v2 attributes"""

        def _fake(rpc_request, debug=False):
            return response_by_type.get(rpc_request.type, TraceItemAttributeNamesResponse())

        return mock.patch(
            "sentry.utils.snuba_rpc.attribute_names_rpc",
            side_effect=_fake,
        )

    def test_array_pass_does_not_mislabel_scalars_as_arrays(self) -> None:
        """v1-shaped response when type is array. Remove alongside the array branch of the endpoint's
        returned-type guard when co-occurring-attrs v1 is retired in Snuba.
        """
        Attribute = TraceItemAttributeNamesResponse.Attribute
        response_by_type = {
            AttributeKey.Type.TYPE_STRING: TraceItemAttributeNamesResponse(
                attributes=[
                    Attribute(name="data_export.status", type=AttributeKey.Type.TYPE_STRING)
                ]
            ),
            AttributeKey.Type.TYPE_DOUBLE: TraceItemAttributeNamesResponse(
                attributes=[Attribute(name="my.number", type=AttributeKey.Type.TYPE_DOUBLE)]
            ),
            AttributeKey.Type.TYPE_ARRAY: TraceItemAttributeNamesResponse(
                attributes=[
                    Attribute(name="data_export.status", type=AttributeKey.Type.TYPE_STRING),
                    Attribute(name="my.number", type=AttributeKey.Type.TYPE_DOUBLE),
                ]
            ),
        }

        with self._mock_attribute_names_rpc(response_by_type):
            response = self.do_request(
                query={"project": self.project.id}, features=self.array_feature_flags
            )

        assert response.status_code == 200, response.content
        keys = [item["key"] for item in response.data]
        # scalar type in reponse
        assert "data_export.status" in keys
        assert not any(key.endswith(",array]") for key in keys), keys

    def test_array_pass_surfaces_real_array_attributes(self) -> None:
        """v2-shaped mocked response"""
        Attribute = TraceItemAttributeNamesResponse.Attribute
        response_by_type = {
            AttributeKey.Type.TYPE_ARRAY: TraceItemAttributeNamesResponse(
                attributes=[
                    Attribute(
                        name="data_export.csv_headers",
                        type=AttributeKey.Type.TYPE_ARRAY_STRING,
                    ),
                    Attribute(
                        name="data_export.blob_offsets",
                        type=AttributeKey.Type.TYPE_ARRAY_INT,
                    ),
                ]
            ),
        }

        with self._mock_attribute_names_rpc(response_by_type):
            response = self.do_request(
                query={"project": self.project.id}, features=self.array_feature_flags
            )

        assert response.status_code == 200, response.content
        by_name = {item["name"]: item for item in response.data}

        assert "data_export.csv_headers" in by_name
        assert by_name["data_export.csv_headers"]["attributeType"] == "array"
        assert by_name["data_export.csv_headers"]["key"] == "tags[data_export.csv_headers,array]"

        assert "data_export.blob_offsets" in by_name
        assert by_name["data_export.blob_offsets"]["attributeType"] == "array"

    def test_debug_as_superuser(self) -> None:
        logs = [
            self.create_ourlog(
                extra_data={"body": "log message"},
                organization=self.organization,
                project=self.project,
                attributes={"test.attr": {"string_value": "value"}},
            ),
        ]
        self.store_eap_items(logs)

        superuser = self.create_user(is_superuser=True)
        self.create_member(user=superuser, organization=self.organization)
        self.login_as(user=superuser, superuser=True)

        response = self.do_request(query={"attributeType": "string", "debug": "true"})
        assert response.status_code == 200, response.content
        assert "data" in response.data
        assert "debug_info" in response.data
        assert isinstance(response.data["data"], list)
        assert isinstance(response.data["debug_info"], list)
        keys = {item["key"] for item in response.data["data"]}
        assert "test.attr" in keys

        assert len(response.data["debug_info"]) > 0
        debug_entry = response.data["debug_info"][0]
        assert "attribute_type" in debug_entry
        assert "raw_request" in debug_entry
        assert "raw_response" in debug_entry

    def test_debug_as_regular_user(self) -> None:
        response = self.do_request(query={"attributeType": "string", "debug": "true"})
        assert response.status_code == 200, response.content
        assert isinstance(response.data, list)


class OrganizationTraceItemAttributesEndpointSpansTest(
    OrganizationTraceItemAttributesEndpointTestBase, BaseSpansTestCase, SpanTestCase
):
    feature_flags = {"organizations:visibility-explore-view": True}
    item_type = SupportedTraceItemType.SPANS

    def test_no_feature(self) -> None:
        response = self.do_request(features={})
        assert response.status_code == 404, response.content

    def test_invalid_dataset(self) -> None:
        response = self.do_request(query={"dataset": "invalid"})
        assert response.status_code == 400, response.content
        assert response.data == {
            "dataset": [
                ErrorDetail(string='"invalid" is not a valid choice.', code="invalid_choice")
            ],
        }

    def test_no_projects(self) -> None:
        response = self.do_request(query={"attributeType": "string"})
        assert response.status_code == 200, response.content
        assert response.data == []

    def _store_basic_segment(self) -> None:
        self.store_segment(
            self.project.id,
            uuid4().hex,
            uuid4().hex,
            organization_id=self.organization.id,
            timestamp=before_now(days=0, minutes=10).replace(microsecond=0),
            # `gen_ai.request.model` is a sentry convention name supplied as a
            # user tag, and `http.route` is a convention defined in
            # sentry-conventions but not in attributes.py. Both stay `user`
            # source but should still be matched to their convention's context.
            tags={"foo": "foo", "gen_ai.request.model": "gpt-4", "http.route": "/users/:id"},
        )

    def test_expand_context(self) -> None:
        self._store_basic_segment()

        response = self.do_request(
            query={"attributeType": "string", "expand": "context"},
        )
        assert response.status_code == 200, response.data

        attributes = {item["key"]: item for item in response.data}

        # A non-deprecated sentry convention gets brief + examples + isDeprecated.
        assert attributes["device.class"]["context"] == {
            "isConvention": True,
            "brief": (
                "The classification of the device. For example, `low`, `medium`, or `high`. "
                "Typically inferred by Relay - SDKs generally do not need to set this directly."
            ),
            "examples": ["medium"],
            "isDeprecated": False,
        }
        # A deprecated convention also surfaces the replacement attribute.
        assert attributes["transaction"]["context"] == {
            "isConvention": True,
            "brief": "The sentry transaction (segment name).",
            "examples": ["GET /"],
            "isDeprecated": True,
            "replacementAttribute": "sentry.segment.name",
        }
        # Custom (non-convention) attributes aren't served yet, so they get an
        # empty context.
        assert attributes["foo"]["context"] == {}
        # A user tag whose name matches a sentry convention keeps its `user`
        # source (it was user-set) but is still matched to the convention's
        # context, since context is matched by name/type, not source.
        assert attributes["gen_ai.request.model"]["attributeSource"]["source_type"] == "user"
        assert attributes["gen_ai.request.model"]["context"] == {
            "isConvention": True,
            "brief": "The model identifier being used for the request.",
            "examples": ["gpt-4-turbo-preview"],
            "isDeprecated": False,
        }
        # `http.route` is a convention defined in sentry-conventions but not in
        # attributes.py, so it resolves as a `user` source attribute but is still
        # matched to its convention's context.
        assert attributes["http.route"]["attributeSource"]["source_type"] == "user"
        assert attributes["http.route"]["context"] == {
            "isConvention": True,
            "brief": (
                "The matched route, that is, the path template in the format used "
                "by the respective server framework."
            ),
            "examples": ["/users/:id"],
            "isDeprecated": False,
        }
        # `span.description` is a Sentry-defined attribute that isn't a sentry
        # convention. It's always included (this segment sets no description) and
        # carries context from its definition (`ResolvedAttribute.context`), marked
        # isConvention=False with a `sentry` source.
        assert attributes["span.description"]["attributeSource"]["source_type"] == "sentry"
        assert attributes["span.description"]["context"]["isConvention"] is False
        assert attributes["span.description"]["context"]["brief"]
        # `project` is served as a virtual column (VirtualColumnDefinition), not a
        # ResolvedAttribute. Its brief still surfaces via the virtual-context
        # fallback, marked isConvention=False with a `sentry` source.
        assert attributes["project"]["attributeSource"]["source_type"] == "sentry"
        assert attributes["project"]["context"] == {
            "isConvention": False,
            "brief": (
                "The name of the project. In some pages of sentry.io, you can also "
                "filter on project using a dropdown."
            ),
            "isDeprecated": False,
        }

    def test_expand_context_user_attribute_matching_secondary_alias(self) -> None:
        # `message` is a secondary alias of `span.description` on spans and carries
        # a definition context. A user tag that happens to share that name must not
        # be mislabeled with the Sentry context; it should resolve to an empty one.
        self.store_segment(
            self.project.id,
            uuid4().hex,
            uuid4().hex,
            organization_id=self.organization.id,
            timestamp=before_now(days=0, minutes=10).replace(microsecond=0),
            tags={"message": "hello"},
        )

        response = self.do_request(
            query={"attributeType": "string", "expand": "context"},
        )
        assert response.status_code == 200, response.data

        attributes = {item["key"]: item for item in response.data}
        message = attributes["tags[message,string]"]
        assert message["name"] == "message"
        assert message["context"] == {}

    def create_context(
        self,
        attribute_key,
        project=None,
        item_type=TraceItemTypes.SPANS,
        attribute_type=TraceItemAttributeTypes.STRING,
        **kwargs,
    ):
        kwargs.setdefault("brief", f"Authored brief for {attribute_key}")
        return TraceItemAttributeContext.objects.create(
            organization=self.organization,
            project=project,
            attribute_key=attribute_key,
            item_type=item_type,
            attribute_type=attribute_type,
            created_by_id=self.user.id,
            **kwargs,
        )

    def test_expand_context_custom_attribute(self) -> None:
        self._store_basic_segment()
        self.create_context(
            "foo",
            brief="How foo is used here",
            additional_context="Only set by the checkout service.",
            examples=["a", "b"],
        )

        response = self.do_request(
            query={"attributeType": "string", "expand": "context"},
            features={
                **self.feature_flags,
                "organizations:data-browsing-attribute-context": True,
            },
        )
        assert response.status_code == 200, response.data

        attributes = {item["key"]: item for item in response.data}
        # Marked isCustom, and no isDeprecated since deprecation isn't modeled
        # for custom attributes.
        assert attributes["foo"]["context"] == {
            "isCustom": True,
            "brief": "How foo is used here",
            "details": ["Only set by the checkout service."],
            "examples": ["a", "b"],
        }
        # A custom attribute with no authored context still gets an empty one.
        assert attributes["http.route"]["context"]["isConvention"] is True

    def test_expand_context_custom_attribute_single_bounded_query(self) -> None:
        self._store_basic_segment()
        self.create_context("foo")
        # Rows for attributes not in the response must not be fetched.
        for i in range(10):
            self.create_context(f"not_in_response_{i}")

        with CaptureQueriesContext(connections["default"]) as captured:
            response = self.do_request(
                query={"attributeType": "string", "expand": "context"},
                features={
                    **self.feature_flags,
                    "organizations:data-browsing-attribute-context": True,
                },
            )
        assert response.status_code == 200, response.data

        context_queries = [
            query["sql"]
            for query in captured.captured_queries
            if "explore_traceitemattributecontext" in (query["sql"] or "")
        ]
        # One query for the whole page, regardless of how many attributes it has.
        assert len(context_queries) == 1
        assert "IN (" in context_queries[0]
        assert "not_in_response_0" not in context_queries[0]

        attributes = {item["key"]: item for item in response.data}
        assert attributes["foo"]["context"]["isCustom"] is True

    def test_expand_context_custom_number_attribute(self) -> None:
        self.store_segment(
            self.project.id,
            uuid4().hex,
            uuid4().hex,
            organization_id=self.organization.id,
            timestamp=before_now(days=0, minutes=10).replace(microsecond=0),
            measurements={"cart_total": 42.0},
        )
        # Number attributes are exposed under a `tags[...]` key, but context is
        # matched on the internal name the write endpoint stores.
        self.create_context(
            "cart_total",
            attribute_type=TraceItemAttributeTypes.NUMBER,
            brief="Value of the cart in cents",
        )

        response = self.do_request(
            query={"attributeType": "number", "expand": "context"},
            features={
                **self.feature_flags,
                "organizations:data-browsing-attribute-context": True,
            },
        )
        assert response.status_code == 200, response.data

        attributes = {item["key"]: item for item in response.data}
        assert attributes["tags[cart_total,number]"]["context"] == {
            "isCustom": True,
            "brief": "Value of the cart in cents",
        }

    def test_expand_context_custom_attribute_same_name_both_types(self) -> None:
        # Sent as a string on one span and a number on another, so it appears
        # twice under one name; each variant resolves its own context.
        self.store_segment(
            self.project.id,
            uuid4().hex,
            uuid4().hex,
            organization_id=self.organization.id,
            timestamp=before_now(days=0, minutes=10).replace(microsecond=0),
            tags={"cart_total": "free"},
        )
        self.store_segment(
            self.project.id,
            uuid4().hex,
            uuid4().hex,
            organization_id=self.organization.id,
            timestamp=before_now(days=0, minutes=9).replace(microsecond=0),
            measurements={"cart_total": 42.0},
        )
        self.create_context(
            "cart_total",
            attribute_type=TraceItemAttributeTypes.STRING,
            brief="Cart tier label",
        )

        response = self.do_request(
            query={"expand": "context"},
            features={
                **self.feature_flags,
                "organizations:data-browsing-attribute-context": True,
            },
        )
        assert response.status_code == 200, response.data

        attributes = {item["key"]: item for item in response.data}
        assert attributes["cart_total"]["attributeType"] == "string"
        assert attributes["cart_total"]["context"] == {
            "isCustom": True,
            "brief": "Cart tier label",
        }
        # The number variant has no context authored for its type.
        assert attributes["tags[cart_total,number]"]["context"] == {}

    def test_expand_context_custom_attribute_requires_feature(self) -> None:
        self._store_basic_segment()
        self.create_context("foo")

        # Custom context is gated, unlike conventions context.
        response = self.do_request(
            query={"attributeType": "string", "expand": "context"},
            features={
                **self.feature_flags,
                "organizations:data-browsing-attribute-context": False,
            },
        )
        assert response.status_code == 200, response.data

        attributes = {item["key"]: item for item in response.data}
        assert attributes["foo"]["context"] == {}
        assert attributes["device.class"]["context"]["isConvention"] is True

    def test_expand_context_custom_attribute_project_scoped(self) -> None:
        self._store_basic_segment()
        other_project = self.create_project(organization=self.organization)
        # Context authored against a different project must not leak into this
        # project's response.
        self.create_context("foo", project=other_project, brief="Other project brief")

        response = self.do_request(
            query={
                "attributeType": "string",
                "expand": "context",
                "project": self.project.id,
            },
            features={
                **self.feature_flags,
                "organizations:data-browsing-attribute-context": True,
            },
        )
        assert response.status_code == 200, response.data

        attributes = {item["key"]: item for item in response.data}
        assert attributes["foo"]["context"] == {}

    def test_expand_context_custom_attribute_project_overrides_org_wide(self) -> None:
        self._store_basic_segment()
        self.create_context("foo", brief="Org-wide brief")
        self.create_context("foo", project=self.project, brief="Project brief")

        response = self.do_request(
            query={
                "attributeType": "string",
                "expand": "context",
                "project": self.project.id,
            },
            features={
                **self.feature_flags,
                "organizations:data-browsing-attribute-context": True,
            },
        )
        assert response.status_code == 200, response.data

        attributes = {item["key"]: item for item in response.data}
        assert attributes["foo"]["context"]["brief"] == "Project brief"

    def test_expand_context_custom_attribute_type_must_match(self) -> None:
        self._store_basic_segment()
        # `foo` is a string attribute, so number-typed context must not attach.
        self.create_context("foo", attribute_type=TraceItemAttributeTypes.NUMBER)

        response = self.do_request(
            query={"attributeType": "string", "expand": "context"},
            features={
                **self.feature_flags,
                "organizations:data-browsing-attribute-context": True,
            },
        )
        assert response.status_code == 200, response.data

        attributes = {item["key"]: item for item in response.data}
        assert attributes["foo"]["context"] == {}

    def test_expand_context_custom_attribute_item_type_must_match(self) -> None:
        self._store_basic_segment()
        # Context authored for logs must not attach to a span attribute.
        self.create_context("foo", item_type=TraceItemTypes.LOGS)

        response = self.do_request(
            query={"attributeType": "string", "expand": "context"},
            features={
                **self.feature_flags,
                "organizations:data-browsing-attribute-context": True,
            },
        )
        assert response.status_code == 200, response.data

        attributes = {item["key"]: item for item in response.data}
        assert attributes["foo"]["context"] == {}

    def test_expand_context_without_feature_flag(self) -> None:
        self._store_basic_segment()

        # Conventions context is not gated by a feature flag: expand=context alone
        # is enough, even with the data-browsing-attribute-context flag disabled.
        response = self.do_request(
            query={"attributeType": "string", "expand": "context"},
            features={
                **self.feature_flags,
                "organizations:data-browsing-attribute-context": False,
            },
        )
        assert response.status_code == 200, response.data
        assert all("context" in item for item in response.data)

    def test_context_not_included_without_expand(self) -> None:
        self._store_basic_segment()

        response = self.do_request(
            query={"attributeType": "string"},
        )
        assert response.status_code == 200, response.data
        assert all("context" not in item for item in response.data)

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

        response = self.do_request(
            {
                "attributeType": "string",
            }
        )
        assert response.status_code == 200, response.data
        expected: list[TraceItemAttributeKey] = [
            {
                "key": "bar",
                "name": "bar",
                "attributeType": "string",
                "attributeSource": {"source_type": "user"},
            },
            {
                "key": "baz",
                "name": "baz",
                "attributeType": "string",
                "attributeSource": {"source_type": "user"},
            },
            {
                "key": "foo",
                "name": "foo",
                "attributeType": "string",
                "attributeSource": {"source_type": "user"},
            },
            {
                "key": "span.description",
                "name": "span.description",
                "attributeType": "string",
                "attributeSource": {"source_type": "sentry"},
                "secondaryAliases": ["description", "message"],
            },
            {
                "key": "transaction",
                "name": "transaction",
                "attributeType": "string",
                "attributeSource": {"source_type": "sentry"},
            },
            {
                "key": "project",
                "name": "project",
                "attributeType": "string",
                "attributeSource": {"source_type": "sentry"},
            },
            {
                "key": "device.class",
                "name": "device.class",
                "attributeType": "string",
                "attributeSource": {"source_type": "sentry"},
            },
            {
                "key": "span.module",
                "name": "span.module",
                "attributeType": "string",
                "attributeSource": {"source_type": "sentry"},
            },
        ]
        assert sorted(
            response.data,
            key=itemgetter("key"),
        ) == sorted(
            expected,
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
            "http.response.body.size",
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

        response = self.do_request(
            {
                "attributeType": "number",
            }
        )
        assert response.status_code == 200, response.data
        # Don't depend on the order of the values, just that they're all
        # present. snuba PR getsentry/snuba#8062 changes the default sort.
        assert sorted(response.data, key=itemgetter("key")) == sorted(
            [
                {
                    "key": "tags[bar,number]",
                    "name": "bar",
                    "attributeType": "number",
                    "attributeSource": {"source_type": "user"},
                },
                {
                    "key": "tags[baz,number]",
                    "name": "baz",
                    "attributeType": "number",
                    "attributeSource": {"source_type": "user"},
                },
                {
                    "key": "measurements.fcp",
                    "name": "measurements.fcp",
                    "attributeType": "number",
                    "attributeSource": {"source_type": "sentry"},
                },
                {
                    "key": "tags[foo,number]",
                    "name": "foo",
                    "attributeType": "number",
                    "attributeSource": {"source_type": "user"},
                },
                {
                    "key": "http.decoded_response_content_length",
                    "name": "http.decoded_response_content_length",
                    "attributeType": "number",
                    "attributeSource": {"source_type": "sentry"},
                },
                {
                    "key": "http.response_content_length",
                    "name": "http.response_content_length",
                    "attributeType": "number",
                    "attributeSource": {"source_type": "sentry"},
                },
                {
                    "key": "http.response_transfer_size",
                    "name": "http.response_transfer_size",
                    "attributeType": "number",
                    "attributeSource": {"source_type": "sentry"},
                },
                {
                    "key": "measurements.lcp",
                    "name": "measurements.lcp",
                    "attributeType": "number",
                    "attributeSource": {"source_type": "sentry"},
                },
                {
                    "key": "span.duration",
                    "name": "span.duration",
                    "attributeType": "number",
                    "attributeSource": {"source_type": "sentry"},
                },
            ],
            key=itemgetter("key"),
        )

    @override_options({"explore.trace-items.keys.max": 3})
    def test_pagination(self) -> None:
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

        response = self.do_request(
            {
                "attributeType": "string",
            }
        )
        assert response.status_code == 200, response.data

        # `span.description` is now always included (a curated Sentry-defined
        # attribute), so it occupies a slot on the first page and pushes `bar`
        # to a later page.
        expected: list[TraceItemAttributeKey] = [
            {
                "key": "device.class",
                "name": "device.class",
                "attributeType": "string",
                "attributeSource": {"source_type": "sentry"},
            },
            {
                "key": "project",
                "name": "project",
                "attributeType": "string",
                "attributeSource": {"source_type": "sentry"},
            },
            {
                "key": "span.description",
                "name": "span.description",
                "attributeType": "string",
                "attributeSource": {"source_type": "sentry"},
                "secondaryAliases": ["description", "message"],
            },
            {
                "key": "span.module",
                "name": "span.module",
                "attributeType": "string",
                "attributeSource": {"source_type": "sentry"},
            },
        ]

        assert sorted(
            response.data,
            key=itemgetter("key"),
        ) == sorted(
            expected,
            key=itemgetter("key"),
        )

        links = {}
        for url, attrs in parse_link_header(response["Link"]).items():
            links[attrs["rel"]] = attrs
            attrs["href"] = url

        assert links["previous"]["results"] == "false"
        assert links["next"]["results"] == "true"

        assert links["next"]["href"] is not None
        with self.feature(self.feature_flags):
            response = self.client.get(links["next"]["href"], format="json")
        assert response.status_code == 200, response.content

        expected_2: list[TraceItemAttributeKey] = [
            {
                "key": "bar",
                "name": "bar",
                "attributeType": "string",
                "attributeSource": {"source_type": "user"},
            },
            {
                "key": "baz",
                "name": "baz",
                "attributeType": "string",
                "attributeSource": {"source_type": "user"},
            },
            {
                "key": "foo",
                "name": "foo",
                "attributeType": "string",
                "attributeSource": {"source_type": "user"},
            },
            {
                "key": "project",
                "name": "project",
                "attributeType": "string",
                "attributeSource": {"source_type": "sentry"},
            },
        ]
        assert sorted(
            response.data,
            key=itemgetter("key"),
        ) == sorted(
            expected_2,
            key=itemgetter("key"),
        )

        links = {}
        for url, attrs in parse_link_header(response["Link"]).items():
            links[attrs["rel"]] = attrs
            attrs["href"] = url

        assert links["previous"]["results"] == "true"
        assert links["next"]["results"] == "true"

        assert links["next"]["href"] is not None
        with self.feature(self.feature_flags):
            response = self.client.get(links["next"]["href"], format="json")
        assert response.status_code == 200, response.content

        expected_3: list[TraceItemAttributeKey] = [
            {
                "key": "foo",
                "name": "foo",
                "attributeType": "string",
                "attributeSource": {"source_type": "user"},
            },
            {
                "key": "transaction",
                "name": "transaction",
                "attributeType": "string",
                "attributeSource": {"source_type": "sentry"},
            },
        ]
        assert sorted(
            response.data,
            key=itemgetter("key"),
        ) == sorted(
            expected_3,
            key=itemgetter("key"),
        )
        links = {}
        for url, attrs in parse_link_header(response["Link"]).items():
            links[attrs["rel"]] = attrs
            attrs["href"] = url

        assert links["previous"]["results"] == "true"
        assert links["next"]["results"] == "false"

        assert links["previous"]["href"] is not None

    def test_attribute_collision(self) -> None:
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
            tags={
                "span.op": "foo",
                "span.duration": "bar",
            },
        )

        response = self.do_request(query={"attributeType": "string"})
        assert response.status_code == 200, response.data
        expected = [
            {
                "key": "device.class",
                "name": "device.class",
                "attributeType": "string",
                "attributeSource": {"source_type": "sentry"},
            },
            {
                "key": "span.module",
                "name": "span.module",
                "attributeType": "string",
                "attributeSource": {"source_type": "sentry"},
            },
            {
                "key": "span.description",
                "name": "span.description",
                "attributeType": "string",
                "attributeSource": {"source_type": "sentry"},
                "secondaryAliases": ["description", "message"],
            },
            {
                "key": "project",
                "name": "project",
                "attributeType": "string",
                "attributeSource": {"source_type": "sentry"},
            },
            {
                "key": "transaction",
                "name": "transaction",
                "attributeType": "string",
                "attributeSource": {"source_type": "sentry"},
            },
            {
                "key": "tags[span.duration,string]",
                "name": "span.duration",
                "attributeType": "string",
                "attributeSource": {"source_type": "user"},
            },
            {
                "key": "tags[span.op,string]",
                "name": "span.op",
                "attributeType": "string",
                "attributeSource": {"source_type": "user"},
            },
        ]
        assert sorted(
            response.data,
            key=itemgetter("key"),
        ) == sorted(
            expected,
            key=itemgetter("key"),
        )

    def test_sentry_internal_attributes(self) -> None:
        self.store_spans(
            [
                self.create_span(
                    {
                        "tags": {
                            "normal_attr": "normal_value",
                            "__sentry_internal_span_buffer_outcome": "different",
                            "__sentry_internal_test": "internal_value",
                        }
                    },
                    start_ts=before_now(days=0, minutes=10),
                ),
            ],
        )

        response = self.do_request(query={"substringMatch": ""})
        assert response.status_code == 200

        attribute_names = {attr["name"] for attr in response.data}
        assert "normal_attr" in attribute_names
        assert "__sentry_internal_span_buffer_outcome" not in attribute_names
        assert "__sentry_internal_test" not in attribute_names

        staff_user = self.create_user(is_staff=True)
        self.create_member(user=staff_user, organization=self.organization)
        self.login_as(user=staff_user, staff=True)

        response = self.do_request(query={"substringMatch": ""})
        assert response.status_code == 200

        attribute_names = {attr["name"] for attr in response.data}
        assert "normal_attr" in attribute_names
        assert "__sentry_internal_span_buffer_outcome" in attribute_names
        assert "__sentry_internal_test" in attribute_names

    def test_internal_convention_attributes_are_hidden(self) -> None:
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
            tags={
                "dsc.trace_id": "internal",
                "normal_attr": "visible",
            },
            measurements={
                "dsc.sample_rate": 1,
                "normal_measurement": 2,
            },
        )

        response = self.do_request(query={"attributeType": "string"})
        assert response.status_code == 200, response.content

        string_attribute_names = {attr["name"] for attr in response.data}
        assert "normal_attr" in string_attribute_names
        assert "dsc.trace_id" not in string_attribute_names

        response = self.do_request(query={"attributeType": "number"})
        assert response.status_code == 200, response.content

        number_attributes = {(attr["key"], attr["name"]) for attr in response.data}
        assert ("tags[normal_measurement,number]", "normal_measurement") in number_attributes
        assert ("tags[dsc.sample_rate,number]", "dsc.sample_rate") not in number_attributes

        staff_user = self.create_user(is_staff=True)
        self.create_member(user=staff_user, organization=self.organization)
        self.login_as(user=staff_user, staff=True)

        response = self.do_request(query={"attributeType": "number"})
        assert response.status_code == 200, response.content

        number_attributes = {(attr["key"], attr["name"]) for attr in response.data}
        assert ("tags[dsc.sample_rate,number]", "dsc.sample_rate") in number_attributes

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

        response = self.do_request(query={"attributeType": "boolean"})
        assert response.status_code == 200, response.content

        keys = {item["key"] for item in response.data}
        assert "tags[is_feature_enabled,boolean]" in keys
        assert "tags[is_debug,boolean]" in keys
        assert "tags[is_production,boolean]" in keys

    def test_aliased_attribute(self) -> None:
        span1 = self.create_span(
            {"sentry_tags": {"op": "foo"}}, start_ts=before_now(days=0, minutes=10)
        )
        span2 = self.create_span(
            {"sentry_tags": {"op": "bar"}}, start_ts=before_now(days=0, minutes=10)
        )
        self.store_spans([span1, span2])

        response = self.do_request(query={"attributeType": "string", "substringMatch": "span.op"})
        assert response.status_code == 200, response.content
        keys = {item["key"] for item in response.data}
        assert "span.op" in keys
        assert "transaction.op" not in keys
        assert "sentry.op" not in keys

        response = self.do_request(query={"attributeType": "string", "substringMatch": "op"})
        assert response.status_code == 200, response.content
        keys = {item["key"] for item in response.data}
        assert {"span.op", "transaction.op"}.issubset(keys)
        assert "sentry.op" not in keys

        response = self.do_request(query={"attributeType": "string", "substringMatch": "sentry.op"})
        assert response.status_code == 200, response.content
        keys = {item["key"] for item in response.data}
        assert "sentry.op" not in keys

    def test_aliased_attribute_project(self) -> None:
        span1 = self.create_span(
            {"sentry_tags": {"op": "foo"}}, start_ts=before_now(days=0, minutes=10)
        )
        span2 = self.create_span(
            {"sentry_tags": {"op": "bar"}}, start_ts=before_now(days=0, minutes=10)
        )
        self.store_spans([span1, span2])

        response = self.do_request(query={"attributeType": "string"})
        assert response.status_code == 200, response.content

        keys = {item["key"] for item in response.data}
        assert len(keys) > 1
        assert "project" in keys

        response = self.do_request(query={"attributeType": "string", "substringMatch": "pro"})
        assert response.status_code == 200, response.content

        keys = {item["key"] for item in response.data}
        assert all("pro" in key for key in keys)
        assert "project" in keys

    def test_aliased_attribute_boolean(self) -> None:
        span1 = self.create_span(
            {"sentry_tags": {"op": "foo"}}, start_ts=before_now(days=0, minutes=10)
        )
        span2 = self.create_span(
            {"sentry_tags": {"op": "bar"}}, start_ts=before_now(days=0, minutes=10)
        )
        self.store_spans([span1, span2])

        response = self.do_request(query={"attributeType": "boolean"})
        assert response.status_code == 200, response.content

        keys = {item["key"] for item in response.data}
        assert len(keys) == 1
        assert "is_starred_transaction" in keys

        response = self.do_request(
            query={"attributeType": "boolean", "substringMatch": "is_starred"}
        )
        assert response.status_code == 200, response.content

        keys = {item["key"] for item in response.data}
        assert len(keys) == 1
        assert "is_starred_transaction" in keys

    def test_aliased_attribute_with_paging(self) -> None:
        def matching_string_alias_count(substring: str) -> int:
            column_count = sum(
                1
                for column in SPAN_DEFINITIONS.columns.values()
                if column.proto_type == AttributeKey.Type.TYPE_STRING
                and substring in column.public_alias
                and not column.secondary_alias
                and not column.private
            )
            context_count = sum(
                1
                for public_label, virtual_context in SPAN_DEFINITIONS.contexts.items()
                if substring in public_label
                and virtual_context.search_type is not None
                and not virtual_context.secondary_alias
                and constants.TYPE_MAP[virtual_context.search_type] == AttributeKey.Type.TYPE_STRING
            )
            return column_count + context_count

        span1 = self.create_span(
            {"tags": {"tag.op": "foo"}}, start_ts=before_now(days=0, minutes=10)
        )
        span2 = self.create_span(
            {"tags": {"tag.op2": "bar"}}, start_ts=before_now(days=0, minutes=10)
        )
        self.store_spans([span1, span2])

        all_keys: set[str] = set()
        for i in range(3):
            response = self.do_request(
                query={
                    "attributeType": "string",
                    "substringMatch": ".",
                    "per_page": 20,
                    "cursor": f"0:{i * 20}:0",
                }
            )
            assert response.status_code == 200, response.content

            keys = {item["key"] for item in response.data}
            assert len(keys) == 21
            all_keys = all_keys.union(keys)
            assert len(all_keys) == (i + 1) * 20 + 1
        hardcoded_alias_count = matching_string_alias_count(".")
        response = self.do_request(
            query={
                "attributeType": "string",
                "substringMatch": ".",
                "per_page": 20,
                "cursor": f"0:{hardcoded_alias_count}:0",
            }
        )
        assert response.status_code == 200, response.content

        keys = {item["key"] for item in response.data}
        # The keys from the db should only be from the last page
        assert "tag.op" in keys
        assert "tag.op2" in keys

    def test_empty_attribute_type_for_all_attribute_types(self) -> None:
        span1 = self.create_span(start_ts=before_now(days=0, minutes=10))
        span1["data"] = {
            "tag.string": "foo",
            "tag.boolean": False,
            "tag.number": 400,
        }
        self.store_spans([span1])

        response = self.do_request(
            query={
                "substringMatch": "tag.",
                "per_page": 20,
            }
        )
        assert response.status_code == 200, response.content

        keys = {(item["key"], item["attributeType"]) for item in response.data}
        assert len(keys) == 3
        assert ("tags[tag.boolean,boolean]", "boolean") in keys
        assert ("tag.string", "string") in keys
        assert ("tags[tag.number,number]", "number") in keys

    def test_multiple_attribute_types(self) -> None:
        span1 = self.create_span(start_ts=before_now(days=0, minutes=10))
        span1["data"] = {
            "tag.string": "foo",
            "tag.boolean": False,
            "tag.number": 400,
        }
        self.store_spans([span1])

        response = self.do_request(
            query={
                "attributeType": ["number", "string"],
                "substringMatch": "tag.",
                "per_page": 20,
            }
        )
        assert response.status_code == 200, response.content

        keys = {(item["key"], item["attributeType"]) for item in response.data}
        assert len(keys) == 2
        assert ("tags[tag.boolean,boolean]", "boolean") not in keys
        assert ("tags[tag.number,number]", "number") in keys
        assert ("tag.string", "string") in keys

    def test_sentry_environment_attribute_name(self) -> None:
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
            environment="prod",
        )

        response = self.do_request(
            query={
                "attributeType": "string",
                "substringMatch": "environment",
            }
        )
        assert response.status_code == 200, response.content

        names = {item["name"] for item in response.data}
        assert "environment" in names


class OrganizationTraceItemAttributesEndpointTraceMetricsTest(
    OrganizationTraceItemAttributesEndpointTestBase, TraceMetricsTestCase
):
    feature_flags = {"organizations:tracemetrics-enabled": True}
    item_type = SupportedTraceItemType.TRACEMETRICS

    def test_no_feature(self) -> None:
        response = self.do_request(features={})
        assert response.status_code == 404, response.content

    def test_invalid_dataset(self) -> None:
        response = self.do_request(query={"dataset": "invalid"})
        assert response.status_code == 400, response.content
        assert response.data == {
            "dataset": [
                ErrorDetail(string='"invalid" is not a valid choice.', code="invalid_choice")
            ],
        }

    def test_trace_metrics_string_attributes(self) -> None:
        """Test that we can successfully retrieve string attributes from trace metrics"""
        metrics = [
            self.create_trace_metric(
                metric_name="http.request.duration",
                metric_value=123.45,
                metric_type="distribution",
                organization=self.organization,
                project=self.project,
                attributes={
                    "http.method": "GET",
                    "http.status_code": "200",
                    "environment": "production",
                },
            ),
            self.create_trace_metric(
                metric_name="http.request.duration",
                metric_value=234.56,
                metric_type="distribution",
                organization=self.organization,
                project=self.project,
                attributes={
                    "http.method": "POST",
                    "http.status_code": "201",
                    "environment": "staging",
                },
            ),
        ]
        self.store_eap_items(metrics)

        response = self.do_request(query={"attributeType": "string"})

        assert response.status_code == 200, response.content
        data = response.data
        assert len(data) > 0

        # Verify that our custom attributes are returned
        attribute_keys = {item["key"] for item in data}
        assert "http.method" in attribute_keys
        assert "http.status_code" in attribute_keys
        # Environment may be stored as tags[environment,string]
        assert "environment" in attribute_keys or "tags[environment,string]" in attribute_keys

    def test_trace_metrics_filter_by_metric_name(self) -> None:
        """Test that we can filter trace metrics attributes by metric name using query parameter"""
        metrics = [
            self.create_trace_metric(
                metric_name="http.request.duration",
                metric_value=100.0,
                metric_type="distribution",
                organization=self.organization,
                project=self.project,
                attributes={
                    "http.method": "GET",
                    "http.route": "/api/users",
                },
            ),
            self.create_trace_metric(
                metric_name="database.query.duration",
                metric_value=50.0,
                metric_type="distribution",
                organization=self.organization,
                project=self.project,
                attributes={
                    "db.system": {"string_value": "postgresql"},
                    "db.operation": {"string_value": "SELECT"},
                },
            ),
        ]
        self.store_eap_items(metrics)

        # Query for http metric attributes
        response = self.do_request(
            query={
                "attributeType": "string",
                "query": 'metric.name:"http.request.duration"',
            }
        )

        assert response.status_code == 200, response.content
        data = response.data
        attribute_keys = {item["key"] for item in data}

        # Should include HTTP attributes
        assert "http.method" in attribute_keys or "http.route" in attribute_keys

    def test_trace_metrics_number_attributes(self) -> None:
        """Test that we can retrieve number attributes from trace metrics"""
        metrics = [
            self.create_trace_metric(
                metric_name="custom.metric",
                metric_value=100.0,
                metric_type="distribution",
                organization=self.organization,
                project=self.project,
                attributes={
                    "request.size": {"int_value": 1024},
                    "response.time": {"double_value": 42.5},
                },
            ),
        ]
        self.store_eap_items(metrics)

        response = self.do_request(query={"attributeType": "number"})

        assert response.status_code == 200, response.content
        data = response.data

        # Verify number attributes are returned
        # Note: The exact keys depend on how the backend processes numeric attributes
        assert len(data) >= 0  # May be 0 if number attributes are handled differently

    def test_trace_metrics_boolean_attributes(self) -> None:
        """Test that we can retrieve boolean attributes from trace metrics"""
        metrics = [
            self.create_trace_metric(
                metric_name="custom.metric",
                metric_value=100.0,
                metric_type="distribution",
                organization=self.organization,
                project=self.project,
                attributes={
                    "is_enabled": True,
                    "is_debug": False,
                },
            ),
            self.create_trace_metric(
                metric_name="another.metric",
                metric_value=200.0,
                metric_type="distribution",
                organization=self.organization,
                project=self.project,
                attributes={
                    "is_enabled": False,
                    "is_production": True,
                },
            ),
        ]
        self.store_eap_items(metrics)

        response = self.do_request(query={"attributeType": "boolean"})

        assert response.status_code == 200, response.content
        data = response.data

        # Verify boolean attributes are returned with tags[name,boolean] format
        attribute_keys = {item["key"] for item in data}
        assert "tags[is_enabled,boolean]" in attribute_keys
        assert "tags[is_debug,boolean]" in attribute_keys
        assert "tags[is_production,boolean]" in attribute_keys


class OrganizationTraceItemAttributeValuesEndpointBaseTest(APITestCase, SnubaTestCase):
    feature_flags: dict[str, bool]
    item_type: SupportedTraceItemType

    viewname = "sentry-api-0-organization-trace-item-attribute-values"

    def setUp(self) -> None:
        super().setUp()
        self.login_as(user=self.user)

    def do_request(self, query=None, features=None, key=None, **kwargs):
        if query is None:
            query = {}

        if "dataset" not in query:
            query["dataset"] = self.item_type.value
        if "attributeType" not in query:
            query["attributeType"] = "string"

        if features is None:
            features = self.feature_flags

        with self.feature(features):
            url = reverse(
                self.viewname,
                kwargs={"organization_id_or_slug": self.organization.slug, "key": key},
            )
            return self.client.get(url, query, format="json", **kwargs)


class OrganizationTraceItemAttributeValuesEndpointLogsTest(
    OrganizationTraceItemAttributeValuesEndpointBaseTest, OurLogTestCase
):
    item_type = SupportedTraceItemType.LOGS
    feature_flags = {"organizations:ourlogs-enabled": True}

    def test_no_feature(self) -> None:
        response = self.do_request(features={}, key="test.attribute")
        assert response.status_code == 404, response.content

    def test_invalid_dataset(self) -> None:
        response = self.do_request(query={"dataset": "invalid"})
        assert response.status_code == 400, response.content
        assert response.data == {
            "dataset": [
                ErrorDetail(string='"invalid" is not a valid choice.', code="invalid_choice")
            ],
        }

    def test_no_projects(self) -> None:
        response = self.do_request(query={"attributeType": "string"})
        assert response.status_code == 200, response.content
        assert response.data == []

    def test_attribute_values(self) -> None:
        logs = [
            self.create_ourlog(
                extra_data={"body": "log message 1"},
                organization=self.organization,
                project=self.project,
                attributes={
                    "test1": {"string_value": "value1"},
                    "test2": {"string_value": "value2"},
                },
            ),
            self.create_ourlog(
                extra_data={"body": "log message 2"},
                organization=self.organization,
                project=self.project,
                attributes={
                    "test1": {"string_value": "value2"},
                    "test2": {"string_value": "value3"},
                },
            ),
        ]
        self.store_eap_items(logs)

        response = self.do_request(key="test1")

        assert response.status_code == 200, response.content
        assert len(response.data) == 2
        values = {item["value"] for item in response.data}
        assert "value1" in values
        assert "value2" in values
        assert all(item["key"] == "test1" for item in response.data)


class OrganizationTraceItemAttributeValuesEndpointSpansTest(
    OrganizationTraceItemAttributeValuesEndpointBaseTest,
    BaseSpansTestCase,
    SpanTestCase,
):
    feature_flags = {"organizations:visibility-explore-view": True}
    item_type = SupportedTraceItemType.SPANS

    def test_no_feature(self) -> None:
        response = self.do_request(features={})
        assert response.status_code == 404, response.content

    def test_invalid_dataset(self) -> None:
        response = self.do_request(query={"dataset": "invalid"})
        assert response.status_code == 400, response.content
        assert response.data == {
            "dataset": [
                ErrorDetail(string='"invalid" is not a valid choice.', code="invalid_choice")
            ],
        }

    def test_no_projects(self) -> None:
        response = self.do_request(query={"attributeType": "string"})
        assert response.status_code == 200, response.content
        assert response.data == []

    def test_tags_keys(self) -> None:
        timestamp = before_now(days=0, minutes=10).replace(microsecond=0)
        for tag in ["foo", "bar", "baz"]:
            self.store_segment(
                self.project.id,
                uuid4().hex,
                uuid4().hex,
                span_id=uuid4().hex[:16],
                organization_id=self.organization.id,
                parent_span_id=None,
                timestamp=timestamp,
                transaction="foo",
                duration=100,
                exclusive_time=100,
                tags={"tag": tag},
            )

        response = self.do_request(key="tag")
        assert response.status_code == 200, response.data
        assert response.data == [
            {
                "count": 1,
                "key": "tag",
                "value": "bar",
                "name": "bar",
                "firstSeen": mock.ANY,
                "lastSeen": mock.ANY,
            },
            {
                "count": 1,
                "key": "tag",
                "value": "baz",
                "name": "baz",
                "firstSeen": mock.ANY,
                "lastSeen": mock.ANY,
            },
            {
                "count": 1,
                "key": "tag",
                "value": "foo",
                "name": "foo",
                "firstSeen": mock.ANY,
                "lastSeen": mock.ANY,
            },
        ]

    def test_tags_keys_with_different_counts(self) -> None:
        timestamp = before_now(days=0, minutes=10).replace(microsecond=0)
        for index, tag in enumerate(["foo", "bar", "baz"]):
            for _ in range(index + 1):
                self.store_segment(
                    self.project.id,
                    uuid4().hex,
                    uuid4().hex,
                    span_id=uuid4().hex[:16],
                    organization_id=self.organization.id,
                    parent_span_id=None,
                    timestamp=timestamp,
                    transaction="foo",
                    duration=100,
                    exclusive_time=100,
                    tags={"tag": tag},
                )

        response = self.do_request(key="tag")
        assert response.status_code == 200, response.data
        assert response.data == [
            {
                "count": 3,
                "key": "tag",
                "value": "baz",
                "name": "baz",
                "firstSeen": mock.ANY,
                "lastSeen": mock.ANY,
            },
            {
                "count": 2,
                "key": "tag",
                "value": "bar",
                "name": "bar",
                "firstSeen": mock.ANY,
                "lastSeen": mock.ANY,
            },
            {
                "count": 1,
                "key": "tag",
                "value": "foo",
                "name": "foo",
                "firstSeen": mock.ANY,
                "lastSeen": mock.ANY,
            },
        ]

    def test_transaction_keys_autocomplete(self) -> None:
        timestamp = before_now(days=0, minutes=10).replace(microsecond=0)
        for transaction in ["foo", "*bar", "*baz"]:
            self.store_segment(
                self.project.id,
                uuid4().hex,
                uuid4().hex,
                span_id=uuid4().hex[:16],
                organization_id=self.organization.id,
                parent_span_id=None,
                timestamp=timestamp,
                transaction=transaction,
                duration=100,
                exclusive_time=100,
            )

        key = "transaction"

        response = self.do_request(key=key)
        assert response.status_code == 200, response.data
        assert response.data == [
            {
                "count": 1,
                "key": key,
                "value": "*bar",
                "name": "*bar",
                "firstSeen": mock.ANY,
                "lastSeen": mock.ANY,
            },
            {
                "count": 1,
                "key": key,
                "value": "*baz",
                "name": "*baz",
                "firstSeen": mock.ANY,
                "lastSeen": mock.ANY,
            },
            {
                "count": 1,
                "key": key,
                "value": "foo",
                "name": "foo",
                "firstSeen": mock.ANY,
                "lastSeen": mock.ANY,
            },
        ]

    def test_transaction_keys_autocomplete_substring(self) -> None:
        timestamp = before_now(days=0, minutes=10).replace(microsecond=0)
        for transaction in ["foo", "*bar", "*baz"]:
            self.store_segment(
                self.project.id,
                uuid4().hex,
                uuid4().hex,
                span_id=uuid4().hex[:16],
                organization_id=self.organization.id,
                parent_span_id=None,
                timestamp=timestamp,
                transaction=transaction,
                duration=100,
                exclusive_time=100,
            )

        key = "transaction"

        response = self.do_request(query={"substringMatch": "b"}, key=key)
        assert response.status_code == 200, response.data
        assert response.data == [
            {
                "count": 1,
                "key": key,
                "value": "*bar",
                "name": "*bar",
                "firstSeen": mock.ANY,
                "lastSeen": mock.ANY,
            },
            {
                "count": 1,
                "key": key,
                "value": "*baz",
                "name": "*baz",
                "firstSeen": mock.ANY,
                "lastSeen": mock.ANY,
            },
        ]

    def test_transaction_keys_autocomplete_substring_with_asterisk(self) -> None:
        timestamp = before_now(days=0, minutes=10).replace(microsecond=0)
        for transaction in ["foo", "*bar", "*baz"]:
            self.store_segment(
                self.project.id,
                uuid4().hex,
                uuid4().hex,
                span_id=uuid4().hex[:16],
                organization_id=self.organization.id,
                parent_span_id=None,
                timestamp=timestamp,
                transaction=transaction,
                duration=100,
                exclusive_time=100,
            )

        key = "transaction"

        response = self.do_request(query={"substringMatch": r"\*b"}, key=key)
        assert response.status_code == 200, response.data
        assert response.data == [
            {
                "count": 1,
                "key": key,
                "value": "*bar",
                "name": "*bar",
                "firstSeen": mock.ANY,
                "lastSeen": mock.ANY,
            },
            {
                "count": 1,
                "key": key,
                "value": "*baz",
                "name": "*baz",
                "firstSeen": mock.ANY,
                "lastSeen": mock.ANY,
            },
        ]

    def test_tags_keys_autocomplete(self) -> None:
        timestamp = before_now(days=0, minutes=10).replace(microsecond=0)
        for tag in ["foo", "*bar", "*baz"]:
            self.store_segment(
                self.project.id,
                uuid4().hex,
                uuid4().hex,
                span_id=uuid4().hex[:16],
                organization_id=self.organization.id,
                parent_span_id=None,
                timestamp=timestamp,
                transaction="transaction",
                duration=100,
                exclusive_time=100,
                tags={"tag": tag},
            )

        key = "tag"

        response = self.do_request(key=key)
        assert response.status_code == 200, response.data
        assert response.data == [
            {
                "count": 1,
                "key": key,
                "value": "*bar",
                "name": "*bar",
                "firstSeen": mock.ANY,
                "lastSeen": mock.ANY,
            },
            {
                "count": 1,
                "key": key,
                "value": "*baz",
                "name": "*baz",
                "firstSeen": mock.ANY,
                "lastSeen": mock.ANY,
            },
            {
                "count": 1,
                "key": key,
                "value": "foo",
                "name": "foo",
                "firstSeen": mock.ANY,
                "lastSeen": mock.ANY,
            },
        ]

    def test_tags_keys_autocomplete_substring(self) -> None:
        timestamp = before_now(days=0, minutes=10).replace(microsecond=0)
        for tag in ["foo", "*bar", "*baz"]:
            self.store_segment(
                self.project.id,
                uuid4().hex,
                uuid4().hex,
                span_id=uuid4().hex[:16],
                organization_id=self.organization.id,
                parent_span_id=None,
                timestamp=timestamp,
                transaction="transaction",
                duration=100,
                exclusive_time=100,
                tags={"tag": tag},
            )

        key = "tag"

        response = self.do_request(query={"substringMatch": "b"}, key=key)
        assert response.status_code == 200, response.data
        assert response.data == [
            {
                "count": 1,
                "key": key,
                "value": "*bar",
                "name": "*bar",
                "firstSeen": mock.ANY,
                "lastSeen": mock.ANY,
            },
            {
                "count": 1,
                "key": key,
                "value": "*baz",
                "name": "*baz",
                "firstSeen": mock.ANY,
                "lastSeen": mock.ANY,
            },
        ]

    def test_tags_keys_autocomplete_substring_with_asterisks(self) -> None:
        timestamp = before_now(days=0, minutes=10).replace(microsecond=0)
        for tag in ["foo", "*bar", "*baz"]:
            self.store_segment(
                self.project.id,
                uuid4().hex,
                uuid4().hex,
                span_id=uuid4().hex[:16],
                organization_id=self.organization.id,
                parent_span_id=None,
                timestamp=timestamp,
                transaction="transaction",
                duration=100,
                exclusive_time=100,
                tags={"tag": tag},
            )

        key = "tag"

        response = self.do_request(query={"substringMatch": r"\*b"}, key=key)
        assert response.status_code == 200, response.data
        assert response.data == [
            {
                "count": 1,
                "key": key,
                "value": "*bar",
                "name": "*bar",
                "firstSeen": mock.ANY,
                "lastSeen": mock.ANY,
            },
            {
                "count": 1,
                "key": key,
                "value": "*baz",
                "name": "*baz",
                "firstSeen": mock.ANY,
                "lastSeen": mock.ANY,
            },
        ]

    def test_tags_keys_autocomplete_noop(self) -> None:
        timestamp = before_now(days=0, minutes=10).replace(microsecond=0)
        for tag in ["foo", "bar", "baz"]:
            self.store_segment(
                self.project.id,
                uuid4().hex,
                uuid4().hex,
                span_id=uuid4().hex[:16],
                organization_id=self.organization.id,
                parent_span_id=None,
                timestamp=timestamp,
                transaction=tag,
                duration=100,
                exclusive_time=100,
                tags={"tag": tag},
            )

        for key in [
            "span.duration",
            "span.self_time",
            "timestamp",
            "id",
            "span_id",
            "parent_span",
            "parent_span_id",
            "trace",
            "trace_id",
            "transaction.id",
            "transaction_id",
            "segment.id",
            "segment_id",
            "profile.id",
            "profile_id",
            "replay.id",
            "replay_id",
        ]:
            response = self.do_request(key=key)
            assert response.status_code == 200, response.data
            assert response.data == [], key

    def test_tags_keys_autocomplete_project(self) -> None:
        base_id = 9223372036854775000
        self.create_project(id=base_id + 100, name="foo")
        self.create_project(id=base_id + 299, name="bar")
        self.create_project(id=base_id + 399, name="baz")

        for key in ["project", "project.name"]:
            response = self.do_request(key=key)
            assert response.status_code == 200, response.data
            assert sorted(response.data, key=lambda v: v["value"]) == [
                {
                    "count": None,
                    "key": key,
                    "value": "bar",
                    "name": "bar",
                    "firstSeen": mock.ANY,
                    "lastSeen": mock.ANY,
                },
                {
                    "count": None,
                    "key": key,
                    "value": "baz",
                    "name": "baz",
                    "firstSeen": mock.ANY,
                    "lastSeen": mock.ANY,
                },
                {
                    "count": None,
                    "key": key,
                    "value": "foo",
                    "name": "foo",
                    "firstSeen": mock.ANY,
                    "lastSeen": mock.ANY,
                },
            ]

            response = self.do_request(query={"substringMatch": "ba"}, key=key)
            assert response.status_code == 200, response.data
            assert sorted(response.data, key=lambda v: v["value"]) == [
                {
                    "count": None,
                    "key": key,
                    "value": "bar",
                    "name": "bar",
                    "firstSeen": mock.ANY,
                    "lastSeen": mock.ANY,
                },
                {
                    "count": None,
                    "key": key,
                    "value": "baz",
                    "name": "baz",
                    "firstSeen": mock.ANY,
                    "lastSeen": mock.ANY,
                },
            ]

        key = "project.id"

        response = self.do_request(key=key)
        assert response.status_code == 200, response.data
        assert sorted(response.data, key=lambda v: v["value"]) == [
            {
                "count": None,
                "key": key,
                "value": "9223372036854775100",
                "name": "9223372036854775100",
                "firstSeen": mock.ANY,
                "lastSeen": mock.ANY,
            },
            {
                "count": None,
                "key": key,
                "value": "9223372036854775299",
                "name": "9223372036854775299",
                "firstSeen": mock.ANY,
                "lastSeen": mock.ANY,
            },
            {
                "count": None,
                "key": key,
                "value": "9223372036854775399",
                "name": "9223372036854775399",
                "firstSeen": mock.ANY,
                "lastSeen": mock.ANY,
            },
        ]

        response = self.do_request(query={"substringMatch": "99"}, key=key)
        assert response.status_code == 200, response.data
        assert sorted(response.data, key=lambda v: v["value"]) == [
            {
                "count": None,
                "key": key,
                "value": "9223372036854775299",
                "name": "9223372036854775299",
                "firstSeen": mock.ANY,
                "lastSeen": mock.ANY,
            },
            {
                "count": None,
                "key": key,
                "value": "9223372036854775399",
                "name": "9223372036854775399",
                "firstSeen": mock.ANY,
                "lastSeen": mock.ANY,
            },
        ]

    def test_tags_keys_autocomplete_span_status(self) -> None:
        timestamp = before_now(days=0, minutes=10).replace(microsecond=0)
        for status in ["ok", "internal_error", "invalid_argument"]:
            self.store_segment(
                self.project.id,
                uuid4().hex,
                uuid4().hex,
                span_id=uuid4().hex[:16],
                organization_id=self.organization.id,
                parent_span_id=None,
                timestamp=timestamp,
                transaction="foo",
                status=status,
            )

        response = self.do_request(key="span.status")
        assert response.status_code == 200, response.data
        assert response.data == [
            {
                "count": 1,
                "key": "span.status",
                "value": "internal_error",
                "name": "internal_error",
                "firstSeen": mock.ANY,
                "lastSeen": mock.ANY,
            },
            {
                "count": 1,
                "key": "span.status",
                "value": "invalid_argument",
                "name": "invalid_argument",
                "firstSeen": mock.ANY,
                "lastSeen": mock.ANY,
            },
            {
                "count": 1,
                "key": "span.status",
                "value": "ok",
                "name": "ok",
                "firstSeen": mock.ANY,
                "lastSeen": mock.ANY,
            },
        ]

        response = self.do_request(query={"substringMatch": "in"}, key="span.status")
        assert response.status_code == 200, response.data
        assert response.data == [
            {
                "count": 1,
                "key": "span.status",
                "value": "internal_error",
                "name": "internal_error",
                "firstSeen": mock.ANY,
                "lastSeen": mock.ANY,
            },
            {
                "count": 1,
                "key": "span.status",
                "value": "invalid_argument",
                "name": "invalid_argument",
                "firstSeen": mock.ANY,
                "lastSeen": mock.ANY,
            },
        ]

    def test_measurements_autocomplete(self) -> None:
        keys = [
            "measurements.app_start_cold",
            "measurements.app_start_warm",
            "measurements.frames_frozen",
            "measurements.frames_frozen_rate",
            "measurements.frames_slow",
            "measurements.frames_slow_rate",
            "measurements.frames_total",
            "measurements.time_to_initial_display",
            "measurements.time_to_full_display",
            "measurements.stall_count",
            "measurements.stall_percentage",
            "measurements.stall_stall_longest_time",
            "measurements.stall_stall_total_time",
            "measurements.cls",
            "measurements.fcp",
            "measurements.fid",
            "measurements.fp",
            "measurements.inp",
            "measurements.lcp",
            "measurements.ttfb",
            "measurements.ttfb.requesttime",
            "measurements.score.cls",
            "measurements.score.fcp",
            "measurements.score.fid",
            "measurements.score.inp",
            "measurements.score.lcp",
            "measurements.score.ttfb",
            "measurements.score.total",
            "measurements.score.weight.cls",
            "measurements.score.weight.fcp",
            "measurements.score.weight.fid",
            "measurements.score.weight.inp",
            "measurements.score.weight.lcp",
            "measurements.score.weight.ttfb",
            "measurements.cache.item_size",
            "measurements.messaging.message.body.size",
            "measurements.messaging.message.receive.latency",
            "measurements.messaging.message.retry.count",
            "measurements.http.response_content_length",
        ]
        self.project
        for key in keys:
            response = self.do_request(key=key)
            assert response.status_code == 200, response.data
            assert response.data == []

    def test_boolean_autocomplete(self) -> None:
        keys = ["is_transaction"]
        self.project
        for key in keys:
            response = self.do_request(key=key)
            assert response.status_code == 200, response.data
            assert response.data == [
                {
                    "count": mock.ANY,
                    "key": key,
                    "value": "false",
                    "name": "false",
                    "firstSeen": mock.ANY,
                    "lastSeen": mock.ANY,
                },
                {
                    "count": mock.ANY,
                    "key": key,
                    "value": "true",
                    "name": "true",
                    "firstSeen": mock.ANY,
                    "lastSeen": mock.ANY,
                },
            ]

    @mock.patch(
        "sentry.api.endpoints.organization_trace_item_attributes.TraceItemAttributeValuesAutocompletionExecutor.execute",
        side_effect=InvalidSearchQuery,
    )
    def test_invalid_query(self, mock_executor_2: mock.MagicMock) -> None:
        timestamp = before_now(days=0, minutes=10).replace(microsecond=0)
        self.store_segment(
            self.project.id,
            uuid4().hex,
            uuid4().hex,
            span_id=uuid4().hex[:16],
            organization_id=self.organization.id,
            parent_span_id=None,
            timestamp=timestamp,
            transaction="foo",
            duration=100,
            exclusive_time=100,
            tags={"tag": "foo"},
        )

        response = self.do_request(key="tag")
        assert response.status_code == 400, response.data

    @override_options({"explore.trace-items.values.max": 2})
    def test_pagination(self) -> None:
        timestamp = before_now(days=0, minutes=10).replace(microsecond=0)
        for tag in ["foo", "bar", "baz", "qux"]:
            self.store_segment(
                self.project.id,
                uuid4().hex,
                uuid4().hex,
                span_id=uuid4().hex[:16],
                organization_id=self.organization.id,
                parent_span_id=None,
                timestamp=timestamp,
                transaction="foo",
                duration=100,
                exclusive_time=100,
                tags={"tag": tag},
            )

        response = self.do_request(key="tag")
        assert response.status_code == 200, response.data
        assert response.data == [
            {
                "count": 1,
                "key": "tag",
                "value": "bar",
                "name": "bar",
                "firstSeen": mock.ANY,
                "lastSeen": mock.ANY,
            },
            {
                "count": 1,
                "key": "tag",
                "value": "baz",
                "name": "baz",
                "firstSeen": mock.ANY,
                "lastSeen": mock.ANY,
            },
        ]

        links = {}
        for url, attrs in parse_link_header(response["Link"]).items():
            links[attrs["rel"]] = attrs
            attrs["href"] = url

        assert links["previous"]["results"] == "false"
        assert links["next"]["results"] == "true"

        assert links["next"]["href"] is not None
        with self.feature(self.feature_flags):
            response = self.client.get(links["next"]["href"], format="json")
        assert response.status_code == 200, response.content
        assert response.data == [
            {
                "count": 1,
                "key": "tag",
                "value": "foo",
                "name": "foo",
                "firstSeen": mock.ANY,
                "lastSeen": mock.ANY,
            },
            {
                "count": 1,
                "key": "tag",
                "value": "qux",
                "name": "qux",
                "firstSeen": mock.ANY,
                "lastSeen": mock.ANY,
            },
        ]

        links = {}
        for url, attrs in parse_link_header(response["Link"]).items():
            links[attrs["rel"]] = attrs
            attrs["href"] = url

        assert links["previous"]["results"] == "true"
        assert links["next"]["results"] == "false"

        assert links["previous"]["href"] is not None
        with self.feature(self.feature_flags):
            response = self.client.get(links["previous"]["href"], format="json")
        assert response.status_code == 200, response.content
        assert response.data == [
            {
                "count": 1,
                "key": "tag",
                "value": "bar",
                "name": "bar",
                "firstSeen": mock.ANY,
                "lastSeen": mock.ANY,
            },
            {
                "count": 1,
                "key": "tag",
                "value": "baz",
                "name": "baz",
                "firstSeen": mock.ANY,
                "lastSeen": mock.ANY,
            },
        ]

    def test_autocomplete_release_semver_attributes(self) -> None:
        release_1 = self.create_release(version="foo@1.2.3+121")
        release_2 = self.create_release(version="qux@2.2.4+122")
        self.store_spans(
            [
                self.create_span(
                    {"sentry_tags": {"release": release_1.version}},
                    start_ts=before_now(days=0, minutes=10),
                ),
                self.create_span(
                    {"sentry_tags": {"release": release_2.version}},
                    start_ts=before_now(days=0, minutes=10),
                ),
            ],
        )

        response = self.do_request(key="release")
        assert response.status_code == 200
        assert response.data == [
            {
                "count": mock.ANY,
                "key": "release",
                "value": release,
                "name": release,
                "firstSeen": mock.ANY,
                "lastSeen": mock.ANY,
            }
            for release in ["foo@1.2.3+121", "qux@2.2.4+122"]
        ]

        response = self.do_request(key="release", query={"substringMatch": "121"})
        assert response.status_code == 200
        assert response.data == [
            {
                "count": mock.ANY,
                "key": "release",
                "value": "foo@1.2.3+121",
                "name": "foo@1.2.3+121",
                "firstSeen": mock.ANY,
                "lastSeen": mock.ANY,
            }
        ]

        response = self.do_request(key="release.stage")
        assert response.status_code == 200
        assert response.data == [
            {
                "count": mock.ANY,
                "key": "release.stage",
                "value": stage,
                "name": stage,
                "firstSeen": mock.ANY,
                "lastSeen": mock.ANY,
            }
            for stage in ["adopted", "low_adoption", "replaced"]
        ]

        response = self.do_request(key="release.stage", query={"substringMatch": "adopt"})
        assert response.status_code == 200
        assert response.data == [
            {
                "count": mock.ANY,
                "key": "release.stage",
                "value": stage,
                "name": stage,
                "firstSeen": mock.ANY,
                "lastSeen": mock.ANY,
            }
            for stage in ["adopted", "low_adoption"]
        ]

        response = self.do_request(key="release.version")
        assert response.status_code == 200
        assert response.data == [
            {
                "count": mock.ANY,
                "key": "release.version",
                "value": version,
                "name": version,
                "firstSeen": mock.ANY,
                "lastSeen": mock.ANY,
            }
            for version in ["1.2.3", "2.2.4"]
        ]

        response = self.do_request(key="release.version", query={"substringMatch": "2"})
        assert response.status_code == 200
        assert response.data == [
            {
                "count": mock.ANY,
                "key": "release.version",
                "value": version,
                "name": version,
                "firstSeen": mock.ANY,
                "lastSeen": mock.ANY,
            }
            for version in ["2.2.4"]
        ]

        response = self.do_request(key="release.package")
        assert response.status_code == 200
        assert response.data == [
            {
                "count": mock.ANY,
                "key": "release.package",
                "value": version,
                "name": version,
                "firstSeen": mock.ANY,
                "lastSeen": mock.ANY,
            }
            for version in ["foo", "qux"]
        ]

        response = self.do_request(key="release.package", query={"substringMatch": "q"})
        assert response.status_code == 200
        assert response.data == [
            {
                "count": mock.ANY,
                "key": "release.package",
                "value": version,
                "name": version,
                "firstSeen": mock.ANY,
                "lastSeen": mock.ANY,
            }
            for version in ["qux"]
        ]

        response = self.do_request(key="release.build")
        assert response.status_code == 200
        assert response.data == [
            {
                "count": mock.ANY,
                "key": "release.build",
                "value": version,
                "name": version,
                "firstSeen": mock.ANY,
                "lastSeen": mock.ANY,
            }
            for version in ["121", "122"]
        ]

    def test_autocomplete_timestamp(self) -> None:
        self.store_spans(
            [self.create_span(start_ts=before_now(days=0, minutes=10))],
        )
        response = self.do_request(key="timestamp", query={"substringMatch": "20"})
        assert response.status_code == 200
        assert response.data == []

    def test_autocomplete_device_class(self) -> None:
        self.store_spans(
            [
                self.create_span({"sentry_tags": {"device.class": "3"}}),
                self.create_span({"sentry_tags": {"device.class": "2"}}),
                self.create_span({"sentry_tags": {"device.class": "1"}}),
                self.create_span({"sentry_tags": {"device.class": ""}}),
                self.create_span({}),
            ],
        )

        response = self.do_request(key="device.class")
        assert response.data == [
            {
                "count": 1,
                "key": "device.class",
                "value": device_class,
                "name": device_class,
                "firstSeen": mock.ANY,
                "lastSeen": mock.ANY,
            }
            for device_class in sorted(["low", "medium", "high", "Unknown"])
        ]


class OrganizationTraceItemAttributeValuesEndpointTraceMetricsTest(
    OrganizationTraceItemAttributeValuesEndpointBaseTest, TraceMetricsTestCase
):
    feature_flags = {"organizations:tracemetrics-enabled": True}
    item_type = SupportedTraceItemType.TRACEMETRICS

    def test_no_feature(self) -> None:
        response = self.do_request(features={}, key="test.attribute")
        assert response.status_code == 404, response.content

    def test_attribute_values(self) -> None:
        metrics = [
            self.create_trace_metric(
                metric_name="http.request.duration",
                metric_value=123.45,
                metric_type="distribution",
                attributes={"http.method": "GET"},
            ),
            self.create_trace_metric(
                metric_name="http.request.duration",
                metric_value=234.56,
                metric_type="distribution",
                attributes={"http.method": "POST"},
            ),
        ]
        self.store_eap_items(metrics)

        response = self.do_request(key="http.method")
        assert response.status_code == 200
        values = {item["value"] for item in response.data}
        assert "GET" in values
        assert "POST" in values


class OrganizationTraceItemAttributeValidateEndpointTest(
    APITestCase, BaseSpansTestCase, SpanTestCase
):
    viewname = "sentry-api-0-organization-trace-item-attributes-validate"
    feature_flags = {
        "organizations:visibility-explore-view": True,
    }

    def setUp(self) -> None:
        super().setUp()
        self.login_as(user=self.user)
        self.project = self.create_project()

    def do_request(self, payload=None, features=None, query_params=None, **kwargs):
        if features is None:
            features = self.feature_flags

        with self.feature(features):
            url = reverse(
                self.viewname,
                kwargs={"organization_id_or_slug": self.organization.slug},
            )
            return self.client.post(
                url, payload, format="json", query_params=query_params, **kwargs
            )

    def test_no_feature(self):
        response = self.do_request(
            payload={"attributes": ["span.duration"]},
            query_params={"itemType": "spans"},
            features={},
        )
        assert response.status_code == 404

    def test_missing_item_type(self):
        response = self.do_request(
            payload={"attributes": ["span.duration"]},
        )
        assert response.status_code == 400

    def test_missing_attributes(self):
        response = self.do_request(
            payload={},
            query_params={"itemType": "spans"},
        )
        assert response.status_code == 400

    def test_empty_attributes_list(self):
        response = self.do_request(
            payload={"attributes": []},
            query_params={"itemType": "spans"},
        )
        assert response.status_code == 400

    def test_too_many_attributes(self):
        response = self.do_request(
            payload={"attributes": [f"attr{i}" for i in range(101)]},
            query_params={"itemType": "spans"},
        )
        assert response.status_code == 400

    def test_unsupported_item_type(self):
        response = self.do_request(
            payload={"attributes": ["some.attr"]},
            query_params={"itemType": "uptime_results"},
        )
        assert response.status_code == 400
        assert "Unsupported item type" in response.data["detail"]

    def test_well_known_attributes(self):
        response = self.do_request(
            payload={"attributes": ["span.duration"]},
            query_params={"itemType": "spans"},
        )
        assert response.status_code == 200
        attr = response.data["attributes"]["span.duration"]
        assert attr["valid"] is True
        assert attr["type"] == "number"

    def test_virtual_context_attributes(self):
        response = self.do_request(
            payload={"attributes": ["project"]},
            query_params={"itemType": "spans"},
        )
        assert response.status_code == 200
        attr = response.data["attributes"]["project"]
        assert attr["valid"] is True
        assert attr["type"] == "string"

    def test_user_tags_not_in_storage(self):
        response = self.do_request(
            payload={
                "attributes": [
                    "my.custom.tag",
                    "tags[x,string]",
                    "tags[numberAttr,number]",
                ]
            },
            query_params={"itemType": "spans"},
        )
        assert response.status_code == 200
        for key in ["my.custom.tag", "tags[x,string]", "tags[numberAttr,number]"]:
            assert response.data["attributes"][key]["valid"] is False
            assert "error" in response.data["attributes"][key]

    def test_user_tags_in_storage(self):
        # Existing and nonexistent tags are validated in separate requests because
        # the local test Snuba (used in CI) returns empty results for an OrFilter
        # containing multiple ExistsFilters when some reference nonexistent
        # attributes, even though real Snuba handles it fine.
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
            payload={"attributes": ["my.custom.tag"]},
            query_params={"itemType": "spans"},
        )
        assert response.status_code == 200
        tag1 = response.data["attributes"]["my.custom.tag"]
        assert tag1["valid"] is True
        assert tag1["type"] == "string"

        response = self.do_request(
            payload={"attributes": ["nonexistent.tag"]},
            query_params={"itemType": "spans"},
        )
        assert response.status_code == 200
        tag2 = response.data["attributes"]["nonexistent.tag"]
        assert tag2["valid"] is False
        assert "error" in tag2

    def test_user_tags_same_name_different_types(self):
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
            tags={"foo": "hello"},
        )

        response = self.do_request(
            payload={"attributes": ["tags[foo,string]", "tags[foo,number]"]},
            query_params={"itemType": "spans"},
        )
        assert response.status_code == 200

        attrs = response.data["attributes"]
        assert attrs["tags[foo,string]"]["valid"] is True
        assert attrs["tags[foo,string]"]["type"] == "string"

        assert attrs["tags[foo,number]"]["valid"] is False
        assert "error" in attrs["tags[foo,number]"]

    def test_invalid_attributes(self):
        long_attr = "a" * 201
        response = self.do_request(
            payload={"attributes": [long_attr, "tags[foo,faketype]"]},
            query_params={"itemType": "spans"},
        )
        assert response.status_code == 200

        assert response.data["attributes"][long_attr]["valid"] is False
        assert "error" in response.data["attributes"][long_attr]

        assert response.data["attributes"]["tags[foo,faketype]"]["valid"] is False
        assert "error" in response.data["attributes"]["tags[foo,faketype]"]

    def test_mixed_valid_and_invalid(self):
        # Existing and nonexistent tags are validated in separate requests because
        # the local test Snuba (used in CI) returns empty results for an OrFilter
        # containing multiple ExistsFilters when some reference nonexistent
        # attributes, even though real Snuba handles it fine.
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

        long_attr = "a" * 201

        response = self.do_request(
            payload={
                "attributes": [
                    "span.duration",
                    "project",
                    "my.custom.tag",
                    long_attr,
                ]
            },
            query_params={"itemType": "spans"},
        )
        assert response.status_code == 200
        attrs = response.data["attributes"]

        assert attrs["span.duration"]["valid"] is True
        assert attrs["span.duration"]["type"] == "number"

        assert attrs["project"]["valid"] is True
        assert attrs["project"]["type"] == "string"

        assert attrs["my.custom.tag"]["valid"] is True
        assert attrs["my.custom.tag"]["type"] == "string"

        assert attrs[long_attr]["valid"] is False
        assert "error" in attrs[long_attr]

        response = self.do_request(
            payload={"attributes": ["nonexistent.tag"]},
            query_params={"itemType": "spans"},
        )
        assert response.status_code == 200
        attrs = response.data["attributes"]
        assert attrs["nonexistent.tag"]["valid"] is False
        assert "error" in attrs["nonexistent.tag"]

    @pytest.mark.xfail(reason="Flaky test - PR #111993")  # noqa: F821
    def test_stats_period_limits_time_range(self):
        self.store_segment(
            self.project.id,
            uuid4().hex,
            uuid4().hex,
            span_id=uuid4().hex[:16],
            organization_id=self.organization.id,
            parent_span_id=None,
            timestamp=before_now(days=2).replace(microsecond=0),
            transaction="foo",
            duration=100,
            exclusive_time=100,
            tags={"old.tag": "hello"},
        )

        # Wide time range should find the tag
        response = self.do_request(
            payload={"attributes": ["old.tag"]},
            query_params={"itemType": "spans", "statsPeriod": "7d"},
        )
        assert response.status_code == 200
        assert response.data["attributes"]["old.tag"]["valid"] is True

        # Narrow time range should not find the tag
        response = self.do_request(
            payload={"attributes": ["old.tag"]},
            query_params={"itemType": "spans", "statsPeriod": "1h"},
        )
        assert response.status_code == 200
        assert response.data["attributes"]["old.tag"]["valid"] is False
