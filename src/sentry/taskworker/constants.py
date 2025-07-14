from enum import Enum

DEFAULT_PROCESSING_DEADLINE = 10
"""
The fallback/default processing_deadline that tasks
will use if neither the TaskNamespace or Task define a deadline
"""

DEFAULT_REBALANCE_AFTER = 32
"""
The number of tasks a worker will process before it
selects a new broker instance.
"""

DEFAULT_CONSECUTIVE_UNAVAILABLE_ERRORS = 3
"""
The number of consecutive unavailable errors before the worker will
stop trying to connect to the broker and choose a new one.
"""

DEFAULT_TEMPORARY_UNAVAILABLE_HOST_TIMEOUT = 20
"""
The number of seconds to wait before a host is considered available again.
"""

DEFAULT_WORKER_QUEUE_SIZE = 5
"""
The size of multiprocessing.Queue used to communicate
with child processes.
"""

DEFAULT_CHILD_TASK_COUNT = 10000
"""
The number of tasks a worker child process will process
before being restarted.
"""


class CompressionType(Enum):
    """
    The type of compression used for task parameters.
    """

    ZSTD = "zstd"
    PLAINTEXT = "plaintext"
