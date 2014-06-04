import itertools

from django.conf import settings

COUNTER_TASKS = set([
    'sentry.tasks.process_buffer.process_pending',
    'sentry.tasks.process_buffer.process_incr',
])

TRIGGER_TASKS = set([
    'sentry.tasks.post_process.post_process_group',
    'sentry.tasks.post_process.execute_rule',
    'sentry.tasks.post_process.plugin_post_process_group',
    'sentry.tasks.post_process.record_affected_user',
    'sentry.tasks.post_process.record_affected_code',
])

COUNTER_QUEUES = itertools.cycle([
    q for q in settings.CELERY_QUEUES
    if q.startswith('counters-')
])

TRIGGER_QUEUES = itertools.cycle([
    q for q in settings.CELERY_QUEUES
    if q.startswith('triggers-')
])


class SplitQueueRouter(object):
    def route_for_task(self, task, args=None, kwargs=None):
        if task == COUNTER_TASKS:
            return {'queue': COUNTER_QUEUES.next()}
        if task == TRIGGER_TASKS:
            return {'queue': TRIGGER_QUEUES.next()}
        return None
