from datetime import datetime

from google.protobuf.timestamp_pb2 import Timestamp
from sentry_protos.snuba.v1.endpoint_time_series_pb2 import TimeSeriesRequest


def add_start_end_conditions(
    in_msg: TimeSeriesRequest, start: datetime, end: datetime
) -> TimeSeriesRequest:
    start_time_proto = Timestamp()
    start_time_proto.FromDatetime(start)
    end_time_proto = Timestamp()
    end_time_proto.FromDatetime(end)
    in_msg.meta.start_timestamp.CopyFrom(start_time_proto)
    in_msg.meta.end_timestamp.CopyFrom(end_time_proto)

    return in_msg
