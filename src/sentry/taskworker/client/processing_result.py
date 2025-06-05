import dataclasses

from sentry_protos.taskbroker.v1.taskbroker_pb2 import TaskActivationStatus


@dataclasses.dataclass
class ProcessingResult:
    """Result structure from child processess to parent"""

    task_id: str
    status: TaskActivationStatus.ValueType
    host: str
    receive_timestamp: float
