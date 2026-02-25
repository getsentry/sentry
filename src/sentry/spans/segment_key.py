# SegmentKey is an internal identifier used by the redis buffer that is also
# directly used as raw redis key. the format is
# "span-buf:s:{project_id:trace_id}:span_id", and the type is bytes because our
# redis client is bytes.
#
# The segment ID in the Kafka protocol is only the span ID.
SegmentKey = bytes


def parse_segment_key(segment_key: SegmentKey) -> tuple[bytes, bytes, bytes]:
    segment_key_parts = segment_key.split(b":")

    if len(segment_key_parts) == 5:
        project_id = segment_key_parts[2][1:]
        trace_id = segment_key_parts[3][:-1]
        span_id = segment_key_parts[4]
    elif len(segment_key_parts) == 6:
        # Temporary format with partition on index 2
        project_id = segment_key_parts[3]
        trace_id = segment_key_parts[4]
        span_id = segment_key_parts[5]
    else:
        raise ValueError("unsupported segment key format")

    return project_id, trace_id, span_id


def segment_key_to_span_id(segment_key: SegmentKey) -> bytes:
    return parse_segment_key(segment_key)[-1]
