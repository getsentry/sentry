from __future__ import annotations

from typing import Protocol, TypeVar

import sentry_protos.snuba.v1alpha.request_common_pb2
import sentry_sdk
import sentry_sdk.scope
from django.conf import settings
from google.protobuf.message import Message as ProtobufMessage

from sentry.net.http import connection_from_url
from sentry.utils.snuba import RetrySkipTimeout

RPCResponseType = TypeVar("RPCResponseType", bound=ProtobufMessage)


_snuba_pool = connection_from_url(
    settings.SENTRY_SNUBA,
    retries=RetrySkipTimeout(
        total=5,
        # Our calls to snuba frequently fail due to network issues. We want to
        # automatically retry most requests. Some of our POSTs and all of our DELETEs
        # do cause mutations, but we have other things in place to handle duplicate
        # mutations.
        allowed_methods={"GET", "POST", "DELETE"},
    ),
    timeout=settings.SENTRY_SNUBA_TIMEOUT,
    maxsize=10,
)


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
        http_resp = _snuba_pool.urlopen(
            "POST",
            f"/rpc/{req.__class__.__name__}",
            body=req.SerializeToString(),
            headers={
                "referer": referrer,
            },
        )
        resp = resp_type()
        resp.ParseFromString(http_resp.data)
        return resp
