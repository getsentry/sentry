import datetime

from sentry.taskworker.constants import CompressionType
from sentry.taskworker.registry import TaskNamespace
from sentry.taskworker.retry import Retry


class TaskworkerConfig:
    """
    This class is a temporary config class use in @instrumented_task
    to shim celery tasks over to taskbroker.
    """

    def __init__(
        self,
        namespace: TaskNamespace,
        retry: Retry | None = None,
        expires: int | datetime.timedelta | None = None,
        processing_deadline_duration: int | datetime.timedelta | None = None,
        at_most_once: bool = False,
        wait_for_delivery: bool = False,
        compression_type: CompressionType = CompressionType.PLAINTEXT,
    ):
        self.namespace = namespace
        self.retry = retry
        self.expires = expires
        self.processing_deadline_duration = processing_deadline_duration
        self.at_most_once = at_most_once
        self.wait_for_delivery = wait_for_delivery
        self.compression_type = compression_type
