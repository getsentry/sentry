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
