"""
sentry.queue.queues
~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from kombu import Exchange, Queue

# All queues should be prefixed with "sentry."
task_exchange = Exchange("tasks", type="direct")
task_queues = [
    Queue("sentry.default", task_exchange, routing_key="sentry.default"),
]
