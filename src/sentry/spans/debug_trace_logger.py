from __future__ import annotations

import logging
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from collections.abc import Sequence

    from sentry_redis_tools.clients import RedisCluster, StrictRedis

logger = logging.getLogger(__name__)


class DebugTraceLogger:
    """
    Logs debug information for specific traces specified in the
    spans.buffer.debug-traces option. The information includes zunionstore
    source set sizes, key existence, and dumps of all spans in the subsegment.
    """

    def __init__(self, client: RedisCluster[bytes] | StrictRedis[bytes]) -> None:
        self._client = client

    def _get_span_key(self, project_and_trace: str, span_id: str) -> bytes:
        return f"span-buf:z:{{{project_and_trace}}}:{span_id}".encode("ascii")

    def log_subsegment_info(
        self,
        project_and_trace: str,
        parent_span_id: str,
        subsegment: Sequence[Any],
    ) -> None:
        spans = []
        span_keys = []
        for span in subsegment:
            spans.append(
                {
                    "span_id": span.span_id,
                    "parent_span_id": span.parent_span_id,
                    "segment_id": span.segment_id,
                }
            )
            if span.span_id != parent_span_id:
                span_keys.append(self._get_span_key(project_and_trace, span.span_id))

        set_sizes: dict[str, int] = {}

        if span_keys:
            with self._client.pipeline(transaction=False) as p:
                for key in span_keys:
                    p.zcard(key)
                results = p.execute()

            for i, key in enumerate(span_keys):
                key_str = key.decode("ascii")
                set_sizes[key_str] = results[i]

        num_existing_keys = sum(1 for size in set_sizes.values() if size > 0)

        logger.info(
            "spans.buffer.debug_subsegment",
            extra={
                "project_and_trace": project_and_trace,
                "parent_span_id": parent_span_id,
                "num_spans_in_subsegment": len(subsegment),
                "zunion_span_key_count": len(span_keys),
                "zunion_existing_key_count": num_existing_keys,
                "set_sizes": set_sizes,
                "total_set_sizes": sum(set_sizes.values()),
                "subsegment_spans": spans,
            },
        )
