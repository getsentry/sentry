from __future__ import annotations

from typing import Protocol, TypeVar

import sentry_protos.snuba.v1alpha.request_common_pb2
import sentry_sdk
import sentry_sdk.scope
from google.protobuf.message import Message as ProtobufMessage

from sentry.utils.snuba import _snuba_pool

RPCResponseType = TypeVar("RPCResponseType", bound=ProtobufMessage)


class SnubaRPCRequest(Protocol):
    def SerializeToString(self, deterministic: bool = ...) -> bytes:
        ...

    @property
    def meta(self) -> sentry_protos.snuba.v1alpha.request_common_pb2.RequestMeta:
        ...


def rpc(req: SnubaRPCRequest, resp_type: type[RPCResponseType]) -> RPCResponseType:
    """
    You want to call a snuba RPC. Here's how you do it:

    start_time_proto = ProtobufTimestamp()
    start_time_proto.FromDatetime(start)
    end_time_proto = ProtobufTimestamp()
    end_time_proto.FromDatetime(end)
    aggregate_req = AggregateBucketRequest(
        meta=RequestMeta(
            organization_id=organization.id,
            cogs_category="events_analytics_platform",
            referrer=referrer,
            project_ids=[project.id for project in projects],
            start_timestamp=start_time_proto,
            end_timestamp=end_time_proto,
        ),
        aggregate=AggregateBucketRequest.FUNCTION_SUM,
        filter=TraceItemFilter(
            comparison_filter=ComparisonFilter(
                key=AttributeKey(name="op", type=AttributeKey.Type.TYPE_STRING),
                value=AttributeValue(val_str="ai.run"),
            )
        ),
        granularity_secs=60,
        key=AttributeKey(
            name="duration", type=AttributeKey.TYPE_FLOAT
        ),
        attribute_key_transform_context=AttributeKeyTransformContext(),
    )
    aggregate_resp = snuba.rpc(aggregate_req, AggregateBucketResponse)
    """
    referrer = req.meta.referrer
    with sentry_sdk.start_span(op="snuba_rpc.run", description=req.__class__.__name__) as span:
        span.set_tag("snuba.referrer", referrer)

        cls = req.__class__
        class_name = cls.__name__
        class_version = cls.__module__.split(".", 3)[2]

        http_resp = _snuba_pool.urlopen(
            "POST",
            f"/rpc/{class_name}/{class_version}",
            body=req.SerializeToString(),
            headers={
                "referer": referrer,
            },
        )
        resp = resp_type()
        resp.ParseFromString(http_resp.data)
        return resp
