"""
sentry.queue.queues
~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from kombu import Exchange, Queue

task_exchange = Exchange("tasks", type="direct")
task_queues = [
    Queue("default", task_exchange, routing_key="default"),
]
