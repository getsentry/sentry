from collections.abc import Sequence
from datetime import datetime, timedelta
from typing import Any
from unittest import mock
from uuid import uuid4

from django.urls import reverse
from google.protobuf.timestamp_pb2 import Timestamp
from rest_framework.response import Response
from sentry_conventions.attributes import ATTRIBUTE_METADATA
from sentry_protos.snuba.v1.endpoint_trace_item_attributes_pb2 import (
    TraceItemAttributeNamesRequest,
    TraceItemAttributeNamesResponse,
)
from sentry_protos.snuba.v1.endpoint_trace_item_table_pb2 import (
    TraceItemTableRequest,
    TraceItemTableResponse,
)
from sentry_protos.snuba.v1.request_common_pb2 import TraceItemType
from sentry_protos.snuba.v1.trace_item_attribute_pb2 import AttributeKey

from sentry import options
from sentry.snuba.referrer import Referrer
from sentry.testutils.cases import (
    APITestCase,
    BaseSpansTestCase,
    OurLogTestCase,
    SpanTestCase,
    TraceMetricsTestCase,
)
from sentry.testutils.helpers.datetime import before_now
from sentry.utils import snuba_rpc

STATS_MODULE = "sentry.api.endpoints.organization_trace_item_attribute_stats"
META_PREFIX = "sentry._meta.fields.attributes"
RELAY_META = '{"meta": {"": {"len": 300, "rem": [["!limit", "s", 0, 10]]}}}'
original_attribute_names_rpc = snuba_rpc.attribute_names_rpc
original_table_rpc = snuba_rpc.table_rpc


def names_response(
    rows: Sequence[tuple[str, datetime | None]],
) -> TraceItemAttributeNamesResponse:
    attributes = []
    for name, last_seen in rows:
        attribute = TraceItemAttributeNamesResponse.Attribute(name=name)
        if last_seen is not None:
            timestamp = Timestamp()
            timestamp.FromDatetime(last_seen)
            attribute.last_seen.CopyFrom(timestamp)
        attributes.append(attribute)
    return TraceItemAttributeNamesResponse(attributes=attributes)


class OrganizationTraceItemAttributeDetailsEndpointTest(
    BaseSpansTestCase, SpanTestCase, OurLogTestCase, TraceMetricsTestCase, APITestCase
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

    def _store_span(
        self,
        tags: dict[str, str] | None = None,
        timestamp: datetime | None = None,
        measurements: dict[str, float] | None = None,
    ) -> None:
        self.store_segment(
            self.project.id,
            uuid4().hex,
            uuid4().hex,
            organization_id=self.organization.id,
            timestamp=timestamp or before_now(minutes=10).replace(microsecond=0),
            tags=tags,
            measurements=measurements,
        )

    def _store_log(
        self,
        attributes: dict[str, Any] | None = None,
        timestamp: datetime | None = None,
    ) -> None:
        self.store_eap_items(
            [
                self.create_ourlog(
                    organization=self.organization,
                    project=self.project,
                    attributes=attributes,
                    timestamp=timestamp,
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
        span_timestamp = before_now(minutes=10).replace(microsecond=0)
        log_timestamp = before_now(minutes=5).replace(microsecond=0)
        self._store_span({"shared.attribute": "span"}, timestamp=span_timestamp)
        self._store_log({"shared.attribute": {"string_value": "log"}}, timestamp=log_timestamp)

        response = self.do_request(
            query={
                "attributeName": "shared.attribute",
                "attributeType": "string",
                "statsPeriod": "14d",
            }
        )

        assert response.status_code == 200, response.content
        assert response.data == {
            "name": "shared.attribute",
            "attributeType": "string",
            "attributeSource": {"source_type": "user"},
            "datasets": ["spans", "logs"],
            "context": {},
            "stats": {
                "spans": {
                    "lastSeen": span_timestamp.isoformat(),
                    "cardinality": 1,
                    "modifiedCount": 0,
                },
                "logs": {"lastSeen": log_timestamp.isoformat(), "cardinality": 1},
            },
            "lastSeen": log_timestamp.isoformat(),
        }

    def test_returns_404_when_only_longer_names_contain_the_attribute_name(self) -> None:
        self._store_span({"cart.id": "a"})

        response = self.do_request(query={"attributeName": "cart", "attributeType": "string"})

        assert response.status_code == 404, response.content

    def test_returns_prefixed_span_attribute_when_requested_by_its_span_details_name(
        self,
    ) -> None:
        self._store_span({"sentry.dsc.environment": "production"})

        response = self.do_request(
            query={"attributeName": "dsc.environment", "attributeType": "string"}
        )

        assert response.status_code == 200, response.content
        assert response.data["name"] == "sentry.dsc.environment"
        assert response.data["datasets"] == ["spans"]

    def test_returns_404_when_only_a_log_attribute_has_the_prefixed_name(self) -> None:
        self._store_log({"sentry.custom": {"string_value": "a"}})

        response = self.do_request(query={"attributeName": "custom", "attributeType": "string"})

        assert response.status_code == 404, response.content

    def test_returns_sentry_column_when_it_is_not_stored_as_an_attribute(self) -> None:
        timestamp = before_now(minutes=10).replace(microsecond=0)
        self._store_span(timestamp=timestamp)

        response = self.do_request(
            query={"attributeName": "trace", "attributeType": "string", "statsPeriod": "14d"}
        )

        assert response.status_code == 200, response.content
        assert response.data["name"] == "trace"
        assert response.data["attributeSource"] == {"source_type": "sentry"}
        assert response.data["datasets"] == ["spans"]
        assert response.data["lastSeen"] == timestamp.isoformat()
        assert list(response.data["stats"]) == ["spans"]

    def test_returns_exact_attribute_when_a_prefixed_span_attribute_shares_its_name(
        self,
    ) -> None:
        self._store_span({"cart": "plain", "sentry.cart": "prefixed"})

        response = self.do_request(query={"attributeName": "cart", "attributeType": "string"})

        assert response.status_code == 200, response.content
        assert response.data["name"] == "cart"

    def test_returns_number_sentry_column_when_it_is_not_stored_as_an_attribute(self) -> None:
        timestamp = before_now(minutes=10).replace(microsecond=0)
        self._store_span(timestamp=timestamp)

        response = self.do_request(
            query={"attributeName": "precise.start_ts", "attributeType": "number"}
        )

        assert response.status_code == 200, response.content
        assert response.data["name"] == "precise.start_ts"
        assert response.data["stats"] == {
            "spans": {
                "lastSeen": timestamp.isoformat(),
                "cardinality": None,
                "modifiedCount": 0,
            }
        }

    def test_returns_each_dataset_with_a_sentry_column_when_several_datasets_have_it(
        self,
    ) -> None:
        self._store_span()
        self._store_log()

        response = self.do_request(query={"attributeName": "trace", "attributeType": "string"})

        assert response.status_code == 200, response.content
        assert response.data["datasets"] == ["spans", "logs"]
        assert list(response.data["stats"]) == ["spans", "logs"]

    def test_returns_sentry_column_without_last_seen_when_its_existence_query_fails(
        self,
    ) -> None:
        self._store_span()

        with mock.patch(
            f"{STATS_MODULE}._query_last_seen_from_table",
            side_effect=snuba_rpc.SnubaRPCError("boom"),
        ):
            response = self.do_request(
                query={"attributeName": "trace", "attributeType": "string", "dataset": "spans"}
            )

        assert response.status_code == 200, response.content
        assert response.data["stats"]["spans"]["lastSeen"] is None
        assert response.data["lastSeen"] is None

    def test_describes_stored_replacement_when_its_public_name_is_a_deprecated_convention(
        self,
    ) -> None:
        self._store_log({"sentry.release": {"string_value": "backend@1.0.0"}})

        response = self.do_request(
            query={"attributeName": "release", "attributeType": "string", "dataset": "logs"}
        )

        changelog = ATTRIBUTE_METADATA["sentry.release"].changelog
        assert changelog is not None
        assert response.status_code == 200, response.content
        assert response.data["context"]["isDeprecated"] is False
        assert "replacementAttribute" not in response.data["context"]
        assert [entry["version"] for entry in response.data["changelog"]] == [
            entry.version for entry in changelog
        ]

    def test_returns_changelog_of_the_convention_its_context_describes_when_stored_under_two_names(
        self,
    ) -> None:
        self.store_spans(
            [
                self.create_span(
                    {"sentry_tags": {"transaction": "/a"}, "data": {"sentry.segment.name": "/a"}}
                )
            ]
        )

        response = self.do_request(
            query={"attributeName": "transaction", "attributeType": "string", "dataset": "spans"}
        )

        changelog = ATTRIBUTE_METADATA["transaction"].changelog
        assert changelog is not None
        assert response.status_code == 200, response.content
        assert response.data["context"]["brief"] == ATTRIBUTE_METADATA["transaction"].brief
        assert [entry["version"] for entry in response.data["changelog"]] == [
            entry.version for entry in changelog
        ]

    def test_returns_changelog_of_the_convention_its_context_describes_when_datasets_store_different_names(
        self,
    ) -> None:
        self.store_spans([self.create_span({"sentry_tags": {"transaction": "/a"}})])
        self.store_eap_items(
            [
                self.create_trace_metric(
                    "my.metric", 1.0, "counter", attributes={"sentry.segment.name": "/a"}
                )
            ]
        )

        response = self.do_request(
            query={"attributeName": "transaction", "attributeType": "string"}
        )

        changelog = ATTRIBUTE_METADATA["transaction"].changelog
        assert changelog is not None
        assert response.status_code == 200, response.content
        assert response.data["datasets"] == ["spans", "tracemetrics"]
        assert response.data["context"]["brief"] == ATTRIBUTE_METADATA["transaction"].brief
        assert [entry["version"] for entry in response.data["changelog"]] == [
            entry.version for entry in changelog
        ]

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

    def test_returns_changelog_without_missing_fields_when_the_attribute_is_a_convention(
        self,
    ) -> None:
        self._store_span({"http.route": "/users/:id"})

        response = self.do_request(
            query={"attributeName": "http.route", "attributeType": "string", "dataset": "spans"}
        )

        assert response.status_code == 200, response.content
        assert response.data["changelog"][-3:] == [
            {
                "version": "0.19.0",
                "prs": [505, 521],
                "description": "Added multiple examples, removed alias to `url.template`, added additional context",
            },
            {"version": "0.1.0", "prs": [127]},
            {"version": "0.0.0"},
        ]

    def test_returns_changelog_when_the_convention_is_keyed_by_the_internal_name(self) -> None:
        self.store_segment(
            self.project.id,
            uuid4().hex,
            uuid4().hex,
            organization_id=self.organization.id,
            timestamp=before_now(minutes=10).replace(microsecond=0),
            op="http.client",
        )

        response = self.do_request(
            query={"attributeName": "span.op", "attributeType": "string", "dataset": "spans"}
        )

        assert response.status_code == 200, response.content
        assert response.data["changelog"][-1:] == [{"version": "0.0.0"}]

    def test_omits_changelog_when_the_attribute_type_differs_from_the_convention(self) -> None:
        self._store_span(measurements={"http.route": 1})

        response = self.do_request(
            query={"attributeName": "http.route", "attributeType": "number", "dataset": "spans"}
        )

        assert response.status_code == 200, response.content
        assert "changelog" not in response.data

    def test_omits_changelog_when_the_attribute_is_not_a_convention(self) -> None:
        self._store_span({"cart": "a"})

        response = self.do_request(
            query={"attributeName": "cart", "attributeType": "string", "dataset": "spans"}
        )

        assert response.status_code == 200, response.content
        assert "changelog" not in response.data

    def test_returns_rollup_last_seen_when_the_name_has_like_wildcards_and_quotes(self) -> None:
        name = 'it\'s "odd": [x] 50%_off\\'
        last_seen = before_now(hours=1).replace(microsecond=0)
        self._store_span({name: "a"})

        with mock.patch(
            f"{STATS_MODULE}.attribute_names_rpc",
            return_value=names_response(
                [('it\'s "odd": [x] 50%_off\\ too', None), (name, last_seen)]
            ),
        ) as names_rpc:
            response = self.do_request(
                query={
                    "attributeName": name,
                    "attributeType": "string",
                    "dataset": "spans",
                    "statsPeriod": "14d",
                }
            )

        assert response.status_code == 200, response.content
        assert response.data["stats"]["spans"]["lastSeen"] == last_seen.isoformat()
        assert response.data["lastSeen"] == last_seen.isoformat()
        assert names_rpc.call_args.args[0].value_substring_match == (
            'it\'s "odd": [x] 50\\%\\_off\\\\'
        )

    def test_returns_rollup_last_seen_when_the_name_has_a_trailing_space(self) -> None:
        last_seen = before_now(hours=1).replace(microsecond=0)
        self._store_span({"cart ": "padded", "cart": "plain"})

        with mock.patch(
            f"{STATS_MODULE}.attribute_names_rpc",
            return_value=names_response([("cart", before_now(minutes=1)), ("cart ", last_seen)]),
        ) as names_rpc:
            response = self.do_request(
                query={
                    "attributeName": "cart ",
                    "attributeType": "string",
                    "dataset": "spans",
                    "statsPeriod": "14d",
                }
            )

        assert response.status_code == 200, response.content
        assert response.data["stats"]["spans"]["lastSeen"] == last_seen.isoformat()
        assert names_rpc.call_args.args[0].value_substring_match == "cart "

    def test_returns_null_last_seen_when_the_rollup_last_seen_predates_the_window(self) -> None:
        window_start = before_now(days=14).replace(hour=0, minute=0, second=0, microsecond=0)
        self._store_span({"cart": "a"})

        with mock.patch(
            f"{STATS_MODULE}.attribute_names_rpc",
            return_value=names_response([("cart", window_start - timedelta(hours=1))]),
        ):
            response = self.do_request(
                query={
                    "attributeName": "cart",
                    "attributeType": "string",
                    "dataset": "spans",
                    "statsPeriod": "14d",
                }
            )

        assert response.status_code == 200, response.content
        assert response.data["stats"] == {
            "spans": {"lastSeen": None, "cardinality": 1, "modifiedCount": 0}
        }
        assert response.data["lastSeen"] is None

    def test_returns_rollup_last_seen_when_it_is_just_after_the_window_start(self) -> None:
        last_seen = before_now(days=14).replace(
            hour=0, minute=0, second=0, microsecond=0
        ) + timedelta(seconds=1)
        self._store_span({"cart": "a"})

        with mock.patch(
            f"{STATS_MODULE}.attribute_names_rpc",
            return_value=names_response([("cart", last_seen)]),
        ):
            response = self.do_request(
                query={
                    "attributeName": "cart",
                    "attributeType": "string",
                    "dataset": "spans",
                    "statsPeriod": "14d",
                }
            )

        assert response.status_code == 200, response.content
        assert response.data["stats"]["spans"]["lastSeen"] == last_seen.isoformat()

    def test_returns_null_last_seen_when_a_short_rollup_response_lacks_the_name(self) -> None:
        self._store_span({"cart": "a"})

        with mock.patch(
            f"{STATS_MODULE}.attribute_names_rpc",
            return_value=names_response([("cart.id", before_now(hours=1))]),
        ):
            response = self.do_request(
                query={
                    "attributeName": "cart",
                    "attributeType": "string",
                    "dataset": "spans",
                    "statsPeriod": "14d",
                }
            )

        assert response.status_code == 200, response.content
        assert response.data["stats"]["spans"]["lastSeen"] is None

    def test_returns_table_last_seen_when_the_rollup_has_no_last_seen(self) -> None:
        timestamp = before_now(minutes=10).replace(microsecond=0)
        self._store_span({"cart": "a"}, timestamp=timestamp)

        with mock.patch(
            f"{STATS_MODULE}.attribute_names_rpc",
            return_value=names_response([("cart", None)]),
        ):
            response = self.do_request(
                query={
                    "attributeName": "cart",
                    "attributeType": "string",
                    "dataset": "spans",
                    "statsPeriod": "14d",
                }
            )

        assert response.status_code == 200, response.content
        assert response.data["stats"]["spans"]["lastSeen"] == timestamp.isoformat()

    def test_returns_table_last_seen_when_a_full_rollup_response_lacks_the_name(self) -> None:
        timestamp = before_now(minutes=10).replace(microsecond=0)
        self._store_span({"cart": "a"}, timestamp=timestamp)
        limit = options.get("explore.trace-items.keys.max")

        with mock.patch(
            f"{STATS_MODULE}.attribute_names_rpc",
            return_value=names_response(
                [(f"cart.{index}", before_now(hours=1)) for index in range(limit)]
            ),
        ):
            response = self.do_request(
                query={
                    "attributeName": "cart",
                    "attributeType": "string",
                    "dataset": "spans",
                    "statsPeriod": "14d",
                }
            )

        assert response.status_code == 200, response.content
        assert response.data["stats"]["spans"]["lastSeen"] == timestamp.isoformat()

    def test_returns_table_last_seen_when_the_names_rpc_raises(self) -> None:
        timestamp = before_now(minutes=10).replace(microsecond=0)
        self._store_span({"cart": "a"}, timestamp=timestamp)

        with mock.patch(
            f"{STATS_MODULE}.attribute_names_rpc",
            side_effect=snuba_rpc.SnubaRPCError("boom"),
        ):
            response = self.do_request(
                query={
                    "attributeName": "cart",
                    "attributeType": "string",
                    "dataset": "spans",
                    "statsPeriod": "14d",
                }
            )

        assert response.status_code == 200, response.content
        assert response.data["stats"]["spans"]["lastSeen"] == timestamp.isoformat()

    def test_returns_stats_when_the_attribute_is_a_number_tag(self) -> None:
        timestamp = before_now(minutes=10).replace(microsecond=0)
        self._store_span(measurements={"cart.total": 1}, timestamp=before_now(minutes=20))
        self._store_span(measurements={"cart.total": 2}, timestamp=timestamp)

        response = self.do_request(
            query={
                "attributeName": "cart.total",
                "attributeType": "number",
                "dataset": "spans",
                "statsPeriod": "14d",
            }
        )

        assert response.status_code == 200, response.content
        assert response.data["stats"] == {
            "spans": {"lastSeen": timestamp.isoformat(), "cardinality": 2, "modifiedCount": 0}
        }

    def test_returns_null_cardinality_when_the_attribute_is_a_boolean(self) -> None:
        timestamp = before_now(minutes=5).replace(microsecond=0)
        self._store_log({"is_active": {"bool_value": True}}, timestamp=timestamp)

        response = self.do_request(
            query={
                "attributeName": "is_active",
                "attributeType": "boolean",
                "dataset": "logs",
                "statsPeriod": "14d",
            }
        )

        assert response.status_code == 200, response.content
        assert response.data["stats"] == {
            "logs": {"lastSeen": timestamp.isoformat(), "cardinality": None}
        }

    def test_returns_null_cardinality_when_the_attribute_is_an_array(self) -> None:
        last_seen = before_now(hours=1).replace(microsecond=0)
        listed = TraceItemAttributeNamesResponse(
            attributes=[
                TraceItemAttributeNamesResponse.Attribute(
                    name="csv_headers", type=AttributeKey.Type.TYPE_ARRAY_STRING
                )
            ]
        )

        def list_names(
            request: TraceItemAttributeNamesRequest, debug: bool = False
        ) -> TraceItemAttributeNamesResponse:
            if request.type == AttributeKey.Type.TYPE_ARRAY:
                return listed
            return TraceItemAttributeNamesResponse()

        with (
            mock.patch("sentry.utils.snuba_rpc.attribute_names_rpc", side_effect=list_names),
            mock.patch(
                f"{STATS_MODULE}.attribute_names_rpc",
                return_value=names_response([("csv_headers", last_seen)]),
            ) as names_rpc,
        ):
            response = self.do_request(
                query={
                    "attributeName": "csv_headers",
                    "attributeType": "array",
                    "dataset": "logs",
                    "statsPeriod": "14d",
                },
                features={
                    **self.feature_flags,
                    "organizations:trace-item-array-query-support": True,
                },
            )

        assert response.status_code == 200, response.content
        assert response.data["stats"] == {
            "logs": {"lastSeen": last_seen.isoformat(), "cardinality": None}
        }
        assert names_rpc.call_args.args[0].type == AttributeKey.Type.TYPE_ARRAY

    def test_returns_null_stats_when_the_attribute_is_a_proxy(self) -> None:
        self._store_span()

        response = self.do_request(
            query={
                "attributeName": "project",
                "attributeType": "string",
                "dataset": "spans",
                "statsPeriod": "14d",
            }
        )

        assert response.status_code == 200, response.content
        assert response.data["stats"] == {
            "spans": {"lastSeen": None, "cardinality": None, "modifiedCount": None}
        }
        assert response.data["lastSeen"] is None

    def test_returns_latest_last_seen_when_the_attribute_is_stored_under_two_names(
        self,
    ) -> None:
        older = before_now(hours=2).replace(microsecond=0)
        newer = before_now(hours=1).replace(microsecond=0)
        self.store_spans(
            [
                self.create_span({"sentry_tags": {"transaction": "/old"}}),
                self.create_span({"data": {"sentry.segment.name": "/new"}}),
            ]
        )

        with mock.patch(
            f"{STATS_MODULE}.attribute_names_rpc",
            return_value=names_response(
                [("sentry.transaction", older), ("sentry.segment.name", newer)]
            ),
        ) as names_rpc:
            response = self.do_request(
                query={
                    "attributeName": "transaction",
                    "attributeType": "string",
                    "dataset": "spans",
                    "statsPeriod": "14d",
                }
            )

        assert response.status_code == 200, response.content
        assert response.data["stats"] == {
            "spans": {"lastSeen": newer.isoformat(), "cardinality": None, "modifiedCount": 0}
        }
        assert sorted(call.args[0].value_substring_match for call in names_rpc.call_args_list) == [
            "sentry.segment.name",
            "sentry.transaction",
        ]

    def test_returns_stats_for_each_dataset_when_the_attribute_is_in_several(self) -> None:
        span_timestamp = before_now(minutes=30).replace(microsecond=0)
        log_timestamp = before_now(minutes=20).replace(microsecond=0)
        metric_timestamp = before_now(minutes=10).replace(microsecond=0)
        self._store_span({"shared.attribute": "a"}, timestamp=span_timestamp)
        self._store_log({"shared.attribute": {"string_value": "b"}}, timestamp=log_timestamp)
        self._store_log({"shared.attribute": {"string_value": "c"}}, timestamp=log_timestamp)
        self.store_eap_items(
            [
                self.create_trace_metric(
                    "my.metric",
                    1.0,
                    "counter",
                    timestamp=metric_timestamp,
                    attributes={"shared.attribute": "d"},
                )
            ]
        )

        response = self.do_request(
            query={
                "attributeName": "shared.attribute",
                "attributeType": "string",
                "statsPeriod": "14d",
            }
        )

        assert response.status_code == 200, response.content
        assert response.data["stats"] == {
            "spans": {"lastSeen": span_timestamp.isoformat(), "cardinality": 1, "modifiedCount": 0},
            "logs": {"lastSeen": log_timestamp.isoformat(), "cardinality": 2},
            "tracemetrics": {"lastSeen": metric_timestamp.isoformat(), "cardinality": 1},
        }
        assert response.data["lastSeen"] == metric_timestamp.isoformat()

    def test_returns_empty_stats_when_the_attribute_has_no_data(self) -> None:
        self._store_span()

        response = self.do_request(
            query={
                "attributeName": "message",
                "attributeType": "string",
                "dataset": "logs",
                "statsPeriod": "14d",
            }
        )

        assert response.status_code == 200, response.content
        assert response.data["stats"] == {"logs": {"lastSeen": None, "cardinality": None}}
        assert response.data["lastSeen"] is None

    def test_returns_other_datasets_stats_when_one_dataset_fails(self) -> None:
        span_timestamp = before_now(minutes=10).replace(microsecond=0)
        self._store_span({"shared.attribute": "a"}, timestamp=span_timestamp)
        self._store_log({"shared.attribute": {"string_value": "b"}})

        def names_rpc(
            request: TraceItemAttributeNamesRequest, debug: bool = False
        ) -> TraceItemAttributeNamesResponse:
            if request.meta.trace_item_type == TraceItemType.TRACE_ITEM_TYPE_LOG:
                raise snuba_rpc.SnubaRPCError("boom")
            return original_attribute_names_rpc(request)

        def table_rpc(requests: list[TraceItemTableRequest]) -> list[TraceItemTableResponse]:
            for request in requests:
                if request.meta.trace_item_type == TraceItemType.TRACE_ITEM_TYPE_LOG:
                    raise snuba_rpc.SnubaRPCError("boom")
            return original_table_rpc(requests)

        with (
            mock.patch(f"{STATS_MODULE}.attribute_names_rpc", side_effect=names_rpc),
            mock.patch(f"{STATS_MODULE}.table_rpc", side_effect=table_rpc),
            mock.patch("sentry.utils.snuba_rpc.table_rpc", side_effect=table_rpc),
        ):
            response = self.do_request(
                query={
                    "attributeName": "shared.attribute",
                    "attributeType": "string",
                    "statsPeriod": "14d",
                }
            )

        assert response.status_code == 200, response.content
        assert response.data["stats"] == {
            "spans": {"lastSeen": span_timestamp.isoformat(), "cardinality": 1, "modifiedCount": 0},
            "logs": {"lastSeen": None, "cardinality": None},
        }
        assert response.data["lastSeen"] == span_timestamp.isoformat()

    def test_returns_unextrapolated_modified_count_when_relay_modified_sampled_values(
        self,
    ) -> None:
        sampled = {"client_sample_rate": {"value": 0.1}}
        self.store_spans(
            [
                self.create_span(
                    {"tags": {"cart": "a" * 10, f"{META_PREFIX}.cart": RELAY_META}},
                    measurements=sampled,
                ),
                self.create_span(
                    {"tags": {"cart": "b" * 10, f"{META_PREFIX}.cart": RELAY_META}},
                    measurements=sampled,
                ),
                self.create_span({"tags": {"cart": "c"}}, measurements=sampled),
            ]
        )

        response = self.do_request(
            query={
                "attributeName": "cart",
                "attributeType": "string",
                "dataset": "spans",
                "statsPeriod": "14d",
            }
        )

        assert response.status_code == 200, response.content
        assert response.data["stats"]["spans"]["modifiedCount"] == 2

    def test_returns_modified_count_when_relay_modified_a_number_attribute(self) -> None:
        self._store_span({f"{META_PREFIX}.cart.total": RELAY_META}, measurements={"cart.total": 5})

        response = self.do_request(
            query={
                "attributeName": "cart.total",
                "attributeType": "number",
                "dataset": "spans",
                "statsPeriod": "14d",
            }
        )

        assert response.status_code == 200, response.content
        assert response.data["stats"]["spans"]["modifiedCount"] == 1

    def test_returns_modified_count_when_relay_renamed_the_attribute(self) -> None:
        self._store_span({f"{META_PREFIX}.sentry.raw_description": RELAY_META})

        response = self.do_request(
            query={
                "attributeName": "span.description",
                "attributeType": "string",
                "dataset": "spans",
                "statsPeriod": "14d",
            }
        )

        assert response.status_code == 200, response.content
        assert response.data["stats"]["spans"]["modifiedCount"] == 1

    def test_returns_modified_count_across_stored_names_when_the_alias_is_shared(self) -> None:
        self.store_spans(
            [
                self.create_span(
                    {
                        "sentry_tags": {"transaction": "/old"},
                        "tags": {f"{META_PREFIX}.sentry.transaction": RELAY_META},
                    }
                ),
                self.create_span(
                    {
                        "data": {
                            "sentry.segment.name": "/new",
                            f"{META_PREFIX}.sentry.segment.name": RELAY_META,
                        }
                    }
                ),
                self.create_span({"sentry_tags": {"transaction": "/plain"}}),
            ]
        )

        response = self.do_request(
            query={
                "attributeName": "transaction",
                "attributeType": "string",
                "dataset": "spans",
                "statsPeriod": "14d",
            }
        )

        assert response.status_code == 200, response.content
        assert response.data["stats"]["spans"]["modifiedCount"] == 2

    def test_omits_modified_count_when_the_dataset_is_not_spans(self) -> None:
        self._store_log({"shared.attribute": {"string_value": "a"}})

        response = self.do_request(
            query={
                "attributeName": "shared.attribute",
                "attributeType": "string",
                "dataset": "logs",
                "statsPeriod": "14d",
            }
        )

        assert response.status_code == 200, response.content
        assert "modifiedCount" not in response.data["stats"]["logs"]

    def test_returns_null_modified_count_when_its_query_fails(self) -> None:
        timestamp = before_now(minutes=10).replace(microsecond=0)
        self._store_span({"cart": "a", f"{META_PREFIX}.cart": RELAY_META}, timestamp=timestamp)

        def table_rpc(requests: list[TraceItemTableRequest]) -> list[TraceItemTableResponse]:
            for request in requests:
                if request.meta.referrer == Referrer.API_TRACE_ITEM_ATTRIBUTE_MODIFIED_COUNT.value:
                    raise snuba_rpc.SnubaRPCError("boom")
            return original_table_rpc(requests)

        with mock.patch("sentry.utils.snuba_rpc.table_rpc", side_effect=table_rpc):
            response = self.do_request(
                query={
                    "attributeName": "cart",
                    "attributeType": "string",
                    "dataset": "spans",
                    "statsPeriod": "14d",
                }
            )

        assert response.status_code == 200, response.content
        assert response.data["stats"] == {
            "spans": {"lastSeen": timestamp.isoformat(), "cardinality": 1, "modifiedCount": None}
        }
