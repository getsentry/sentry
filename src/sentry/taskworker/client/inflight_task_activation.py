import dataclasses

from sentry_protos.taskbroker.v1.taskbroker_pb2 import TaskActivation


@dataclasses.dataclass
class InflightTaskActivation:
    activation: TaskActivation
    host: str
    receive_timestamp: float
