"""
Background:
    proto3 has no required fields — every field has an implicit default value
    (0 for integers, empty string for strings, None for message types). The
    ProtobufCodec in sentry-kafka-schemas performs no semantic validation:
    its validate() method is a no-op. This means a Sentry producer can omit
    critical fields like `organization_id` or `project_id`, and the message
    will encode and produce to Kafka (and even get written to Snuba)
    without error.
"""

import uuid
from datetime import datetime, timedelta
from datetime import timezone as dt_timezone

import pytest
import requests
from django.conf import settings
from google.protobuf.timestamp_pb2 import Timestamp
from sentry_protos.snuba.v1.endpoint_trace_item_table_pb2 import (
    Column,
    TraceItemTableRequest,
)
from sentry_protos.snuba.v1.request_common_pb2 import PageToken, RequestMeta, TraceItemType
from sentry_protos.snuba.v1.trace_item_attribute_pb2 import AttributeKey, AttributeValue
from sentry_protos.snuba.v1.trace_item_filter_pb2 import ComparisonFilter, TraceItemFilter
from sentry_protos.snuba.v1.trace_item_pb2 import TraceItem

from sentry.conf.types.kafka_definition import Topic, get_topic_codec
from sentry.search.eap.rpc_utils import anyvalue
from sentry.testutils.cases import SnubaTestCase, TestCase
from sentry.utils import snuba_rpc
from sentry.utils.eap import EAP_ITEMS_INSERT_ENDPOINT, hex_to_item_id
from sentry.utils.snuba_rpc import SnubaRPCError

_DEMO_NAMESPACE = uuid.UUID("c0ffee00-dead-beef-cafe-000000000001")
_DEMO_ITEM_TYPE = TraceItemType.TRACE_ITEM_TYPE_SPAN


def _build_trace_item(
    organization_id: int | None,
    project_id: int | None,
    timestamp: Timestamp | None,
    received: Timestamp | None,
    trace_id: str | None,
    item_id: bytes | None,
    item_type: int | None,
    retention_days: int | None,
    label: str = "demo-item",
) -> TraceItem:
    """
    Build a minimal TraceItem for data contract validation tests.
    """
    kwargs: dict = dict(
        attributes={"demo_label": anyvalue(label)},
        client_sample_rate=1.0,
        server_sample_rate=1.0,
    )
    if organization_id is not None:
        kwargs["organization_id"] = organization_id
    if project_id is not None:
        kwargs["project_id"] = project_id
    if timestamp is not None:
        kwargs["timestamp"] = timestamp
    if received is not None:
        kwargs["received"] = received
    if trace_id is not None:
        kwargs["trace_id"] = trace_id
    if item_id is not None:
        kwargs["item_id"] = item_id
    if item_type is not None:
        kwargs["item_type"] = item_type
    if retention_days is not None:
        kwargs["retention_days"] = retention_days

    return TraceItem(**kwargs)


def _query_by_label(
    organization_id: int,
    project_ids: list[int],
    label: str,
    now: datetime,
    extra_columns: list[Column] | None = None,
    item_type: int = _DEMO_ITEM_TYPE,
) -> list[dict]:
    """
    Query EAP for items matching the given demo_label attribute.

    Returns a list of dicts (one per row) with the queried column values,
    or an empty list if no results are found.
    """
    start = Timestamp(seconds=int((now - timedelta(hours=1)).timestamp()))
    end = Timestamp(seconds=int((now + timedelta(hours=1)).timestamp()))

    columns = [
        Column(
            label="demo_label",
            key=AttributeKey(name="demo_label", type=AttributeKey.Type.TYPE_STRING),
        ),
    ]
    if extra_columns:
        columns.extend(extra_columns)

    request = TraceItemTableRequest(
        meta=RequestMeta(
            referrer="test.eap_data_contract_validation",
            organization_id=organization_id,
            project_ids=project_ids,
            trace_item_type=item_type,
            start_timestamp=start,
            end_timestamp=end,
        ),
        columns=columns,
        filter=TraceItemFilter(
            comparison_filter=ComparisonFilter(
                key=AttributeKey(name="demo_label", type=AttributeKey.Type.TYPE_STRING),
                op=ComparisonFilter.OP_EQUALS,
                value=AttributeValue(val_str=label),
            )
        ),
        limit=10,
        page_token=PageToken(offset=0),
    )

    responses = snuba_rpc.table_rpc([request])
    response = responses[0]

    if not response.column_values or not response.column_values[0].results:
        return []

    num_rows = len(response.column_values[0].results)
    cols = {cv.attribute_name: cv for cv in response.column_values}
    return [{name: col.results[i] for name, col in cols.items()} for i in range(num_rows)]


class EAPDataContractValidationGapTest(TestCase, SnubaTestCase):
    def test_baseline_complete_item(self):
        """
        A correctly-formed TraceItem round-trips through the pipeline and is
        queryable by the real organization_id. Proves the test infrastructure
        works before we demonstrate the gaps.
        """
        now = datetime.now(dt_timezone.utc)
        ts = Timestamp(seconds=int(now.timestamp()))
        label = "demo-baseline-complete"

        trace_item = _build_trace_item(
            organization_id=self.organization.id,
            project_id=self.project.id,
            timestamp=ts,
            received=ts,
            trace_id=uuid.uuid4().hex,
            item_id=hex_to_item_id(uuid.uuid5(_DEMO_NAMESPACE, label).hex),
            item_type=_DEMO_ITEM_TYPE,
            retention_days=90,
            label=label,
        )

        self.store_eap_items([trace_item])

        rows = _query_by_label(self.organization.id, [self.project.id], label, now)
        assert len(rows) == 1, "Baseline item not found"
        assert rows[0]["demo_label"].val_str == label

    def test_codec_accepts_missing_required_fields(self):
        """
        The ProtobufCodec encodes a TraceItem missing the `received` field
        without raising any error. Without any added validation, this is
        expected behavior, since all fields are optional in proto3.
        """
        now = datetime.now(dt_timezone.utc)
        ts = Timestamp(seconds=int(now.timestamp()))
        codec = get_topic_codec(Topic.SNUBA_ITEMS)

        label = "demo-missing-received-codec"
        # received is not passed — proto3 leaves it unset (None for message types)
        trace_item = _build_trace_item(
            organization_id=1,
            project_id=1,
            timestamp=ts,
            received=None,
            trace_id=uuid.uuid4().hex,
            item_id=hex_to_item_id(uuid.uuid5(_DEMO_NAMESPACE, label).hex),
            item_type=_DEMO_ITEM_TYPE,
            retention_days=90,
            label=label,
        )

        assert not trace_item.HasField("received")

        # Encode succeeds
        encoded = codec.encode(trace_item)
        assert len(encoded) > 0

        # Round-trip decode succeeds
        decoded = codec.decode(encoded)
        assert not decoded.HasField("received")

    def test_missing_organization_id(self):
        """
        A TraceItem where the producer never sets organization_id defaults to 0
        (proto3's default for uint64). It encodes and writes to ClickHouse
        without error.
        """
        now = datetime.now(dt_timezone.utc)
        ts = Timestamp(seconds=int(now.timestamp()))
        label = "demo-missing-org-id"

        # organization_id is not passed — proto3 defaults it to 0
        trace_item = _build_trace_item(
            organization_id=None,
            project_id=self.project.id,
            timestamp=ts,
            received=ts,
            trace_id=uuid.uuid4().hex,
            item_id=hex_to_item_id(uuid.uuid5(_DEMO_NAMESPACE, label).hex),
            item_type=_DEMO_ITEM_TYPE,
            retention_days=90,
            label=label,
        )
        assert trace_item.organization_id == 0

        # Encode succeeds — proto3 treats 0 as the default, not as invalid
        codec = get_topic_codec(Topic.SNUBA_ITEMS)
        encoded = codec.encode(trace_item)
        assert len(encoded) > 0

        # Write to ClickHouse succeeds — no error at any layer
        self.store_eap_items([trace_item])

        # Query by the REAL organization_id — the data is not found
        rows_real_org = _query_by_label(self.organization.id, [self.project.id], label, now)
        assert len(rows_real_org) == 0

        # Query by organization_id=0 — the data IS here, silently orphaned
        rows_org0 = _query_by_label(
            0,
            [self.project.id],
            label,
            now,
            extra_columns=[
                Column(
                    label="sentry.organization_id",
                    key=AttributeKey(
                        name="sentry.organization_id", type=AttributeKey.Type.TYPE_INT
                    ),
                ),
                Column(
                    label="sentry.project_id",
                    key=AttributeKey(name="sentry.project_id", type=AttributeKey.Type.TYPE_INT),
                ),
                Column(
                    label="sentry.timestamp",
                    key=AttributeKey(name="sentry.timestamp", type=AttributeKey.Type.TYPE_DOUBLE),
                ),
            ],
        )
        assert len(rows_org0) == 1

        row = rows_org0[0]
        assert row["demo_label"].val_str == label
        assert row["sentry.organization_id"].val_int == 0
        assert row["sentry.project_id"].val_int == self.project.id
        assert row["sentry.timestamp"].val_double == pytest.approx(ts.seconds, abs=1)

    def test_missing_project_id(self):
        """
        A TraceItem where the producer never sets project_id defaults to 0
        (proto3's default for uint64). The data writes to ClickHouse but is
        invisible to project-scoped queries — silently orphaned under
        project_id=0.
        """
        now = datetime.now(dt_timezone.utc)
        ts = Timestamp(seconds=int(now.timestamp()))
        label = "demo-missing-project-id"

        trace_item = _build_trace_item(
            organization_id=self.organization.id,
            project_id=None,
            timestamp=ts,
            received=ts,
            trace_id=uuid.uuid4().hex,
            item_id=hex_to_item_id(uuid.uuid5(_DEMO_NAMESPACE, label).hex),
            item_type=_DEMO_ITEM_TYPE,
            retention_days=90,
            label=label,
        )
        assert trace_item.project_id == 0

        codec = get_topic_codec(Topic.SNUBA_ITEMS)
        encoded = codec.encode(trace_item)
        assert len(encoded) > 0

        self.store_eap_items([trace_item])

        # Query by the REAL project_id — the data is not found
        rows_real = _query_by_label(self.organization.id, [self.project.id], label, now)
        assert len(rows_real) == 0

        # Query by project_id=0 — the data IS here, silently orphaned
        rows_proj0 = _query_by_label(
            self.organization.id,
            [0],
            label,
            now,
            extra_columns=[
                Column(
                    label="sentry.project_id",
                    key=AttributeKey(name="sentry.project_id", type=AttributeKey.Type.TYPE_INT),
                ),
            ],
        )
        assert len(rows_proj0) == 1

        row = rows_proj0[0]
        assert row["demo_label"].val_str == label
        assert row["sentry.project_id"].val_int == 0

    def test_missing_item_id(self):
        """
        A TraceItem where the producer never sets item_id defaults to empty
        bytes (proto3's default for bytes fields). The codec encodes it
        without error, but Snuba's read_item_id calls split_at(16) on the
        empty vec and panics — a latent crash bug in the same class as the
        INC-2060 received panic.
        """
        now = datetime.now(dt_timezone.utc)
        ts = Timestamp(seconds=int(now.timestamp()))
        label = "demo-missing-item-id"

        trace_item = _build_trace_item(
            organization_id=self.organization.id,
            project_id=self.project.id,
            timestamp=ts,
            received=ts,
            trace_id=uuid.uuid4().hex,
            item_id=None,
            item_type=_DEMO_ITEM_TYPE,
            retention_days=90,
            label=label,
        )
        assert trace_item.item_id == b""

        codec = get_topic_codec(Topic.SNUBA_ITEMS)
        encoded = codec.encode(trace_item)
        assert len(encoded) > 0

        # Snuba panics: read_item_id calls split_at(16) on empty vec
        response = requests.post(
            settings.SENTRY_SNUBA + EAP_ITEMS_INSERT_ENDPOINT,
            files={"item_0": trace_item.SerializeToString()},
        )
        assert response.status_code == 500

    def test_missing_item_type(self):
        """
        A TraceItem where the producer never sets item_type defaults to 0
        (TRACE_ITEM_TYPE_UNSPECIFIED). The data writes to ClickHouse, but:
        - Querying by the intended type (SPAN) returns nothing
        - Querying by UNSPECIFIED is rejected by the Snuba RPC endpoint
        """
        now = datetime.now(dt_timezone.utc)
        ts = Timestamp(seconds=int(now.timestamp()))
        label = "demo-missing-item-type"

        trace_item = _build_trace_item(
            organization_id=self.organization.id,
            project_id=self.project.id,
            timestamp=ts,
            received=ts,
            trace_id=uuid.uuid4().hex,
            item_id=hex_to_item_id(uuid.uuid5(_DEMO_NAMESPACE, label).hex),
            item_type=None,
            retention_days=90,
            label=label,
        )
        assert trace_item.item_type == 0

        codec = get_topic_codec(Topic.SNUBA_ITEMS)
        encoded = codec.encode(trace_item)
        assert len(encoded) > 0

        self.store_eap_items([trace_item])

        # Query by intended type (SPAN) — not found
        rows_span = _query_by_label(self.organization.id, [self.project.id], label, now)
        assert len(rows_span) == 0

        # Query by UNSPECIFIED — Snuba RPC rejects the request entirely
        with pytest.raises(SnubaRPCError):
            _query_by_label(
                self.organization.id,
                [self.project.id],
                label,
                now,
                item_type=TraceItemType.TRACE_ITEM_TYPE_UNSPECIFIED,
            )

    def test_missing_retention_days(self):
        """
        A TraceItem where the producer never sets retention_days defaults to 0
        (proto3's default for uint32). Snuba's enforce_retention silently
        overrides 0 to the lower bound (30 days). The producer intended some
        retention period but the data gets 30 days with no error or warning.
        """
        now = datetime.now(dt_timezone.utc)
        ts = Timestamp(seconds=int(now.timestamp()))
        label = "demo-missing-retention-days"

        trace_item = _build_trace_item(
            organization_id=self.organization.id,
            project_id=self.project.id,
            timestamp=ts,
            received=ts,
            trace_id=uuid.uuid4().hex,
            item_id=hex_to_item_id(uuid.uuid5(_DEMO_NAMESPACE, label).hex),
            item_type=_DEMO_ITEM_TYPE,
            retention_days=None,
            label=label,
        )
        assert trace_item.retention_days == 0

        codec = get_topic_codec(Topic.SNUBA_ITEMS)
        encoded = codec.encode(trace_item)
        assert len(encoded) > 0

        # Write succeeds — enforce_retention silently overrides 0 → 30
        self.store_eap_items([trace_item])

        rows = _query_by_label(self.organization.id, [self.project.id], label, now)
        assert len(rows) == 1
        assert rows[0]["demo_label"].val_str == label

    @pytest.mark.skip(reason="Should be succeeding with fix from INC-2060")
    def test_missing_received(self):
        """
        A TraceItem where the producer never sets received (a Timestamp message
        field) defaults to None. The codec encodes it without error.
        """
        now = datetime.now(dt_timezone.utc)
        ts = Timestamp(seconds=int(now.timestamp()))
        label = "demo-missing-received"

        trace_item = _build_trace_item(
            organization_id=self.organization.id,
            project_id=self.project.id,
            timestamp=ts,
            received=None,
            trace_id=uuid.uuid4().hex,
            item_id=hex_to_item_id(uuid.uuid5(_DEMO_NAMESPACE, label).hex),
            item_type=_DEMO_ITEM_TYPE,
            retention_days=90,
            label=label,
        )
        assert not trace_item.HasField("received")

        codec = get_topic_codec(Topic.SNUBA_ITEMS)
        encoded = codec.encode(trace_item)
        assert len(encoded) > 0

        # Write succeeds
        self.store_eap_items([trace_item])

        rows = _query_by_label(self.organization.id, [self.project.id], label, now)
        assert len(rows) == 1
        assert rows[0]["demo_label"].val_str == label
