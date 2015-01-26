from __future__ import absolute_import

import itertools

from celery import current_app


COUNTER_TASKS = set([
    'sentry.tasks.process_buffer.process_pending',
    'sentry.tasks.process_buffer.process_incr',
])

TRIGGER_TASKS = set([
    'sentry.tasks.post_process.post_process_group',
    'sentry.tasks.post_process.plugin_post_process_group',
    'sentry.tasks.post_process.record_affected_user',
    'sentry.tasks.post_process.record_affected_code',
])


class SplitQueueRouter(object):
    def __init__(self):
        queues = current_app.conf['CELERY_QUEUES']
        self.counter_queues = itertools.cycle([
            q.name for q in queues
            if q.name.startswith('counters-')
        ])

        self.trigger_queues = itertools.cycle([
            q.name for q in queues
            if q.name.startswith('triggers-')
        ])

    def route_for_task(self, task, *args, **kwargs):
        if task in COUNTER_TASKS:
            return {'queue': self.counter_queues.next()}
        if task in TRIGGER_TASKS:
            return {'queue': self.trigger_queues.next()}
        return None
