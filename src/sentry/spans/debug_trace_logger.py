from __future__ import annotations

import logging
from typing import TYPE_CHECKING, Any

from sentry.spans.segment_key import SegmentKey, parse_segment_key

if TYPE_CHECKING:
    from collections.abc import Sequence

    from sentry_redis_tools.clients import RedisCluster, StrictRedis

logger = logging.getLogger(__name__)


class DebugTraceLogger:
    """
    Logs debug information for specific traces specified in the
    spans.buffer.debug-traces option. The information includes sunionstore
    source set sizes, key existence, and dumps of all spans in the subsegment.
    """

    def __init__(self, client: RedisCluster[bytes] | StrictRedis[bytes]) -> None:
        self._client = client

    def _get_span_key(self, project_and_trace: str, span_id: str) -> bytes:
        return f"span-buf:s:{{{project_and_trace}}}:{span_id}".encode("ascii")

    def log_subsegment_info(
        self,
        project_and_trace: str,
        parent_span_id: str,
        subsegment: Sequence[Any],
        debug_traces: set[str],
    ) -> None:
        _, _, trace_id = project_and_trace.partition(":")
        if trace_id not in debug_traces:
            return

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
                    p.scard(key)
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
                "sunion_span_key_count": len(span_keys),
                "sunion_existing_key_count": num_existing_keys,
                "set_sizes": set_sizes,
                "total_set_sizes": sum(set_sizes.values()),
                "subsegment_spans": spans,
            },
        )

    def log_flush_info(
        self,
        segment_key: SegmentKey,
        segment_span_id: str,
        root_span_in_segment: bool,
        num_spans: int,
        debug_traces: set[str],
    ) -> None:
        project_id, trace_id, _ = parse_segment_key(segment_key)
        if trace_id.decode("ascii") not in debug_traces:
            return

        hrs_key = b"span-buf:hrs:" + segment_key
        has_root_span_flag = bool(self._client.exists(hrs_key))

        project_and_trace = f"{project_id.decode('ascii')}:{trace_id.decode('ascii')}"

        logger.info(
            "spans.buffer.debug_flush",
            extra={
                "project_and_trace": project_and_trace,
                "segment_span_id": segment_span_id,
                "has_root_span_flag": has_root_span_flag,
                "root_span_in_segment": root_span_in_segment,
                "num_spans": num_spans,
            },
        )
