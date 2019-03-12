from __future__ import absolute_import, print_function

from batching_kafka_consumer import AbstractBatchWorker

from django.conf import settings

import sentry.tasks.store as store_tasks
from sentry.utils import json


# We need a unique value to indicate when to stop multiprocessing queue
# an identity on an object() isn't guaranteed to work between parent
# and child proc
_STOP_WORKER = '91650ec271ae4b3e8a67cdc909d80f8c'


def handle_preprocess(message):
    data = message['data']
    event_id = data['event_id']
    cache_key = message['cache_key']
    start_time = message['start_time']
    process_task = (
        store_tasks.process_event_from_reprocessing
        if message['from_reprocessing']
        else store_tasks.process_event
    )

    store_tasks._do_preprocess_event(cache_key, data, start_time, event_id, process_task)


def handle_process(message):
    data = message['data']
    event_id = data['event_id']
    cache_key = message['cache_key']
    start_time = message['start_time']

    if message['from_reprocessing']:
        task = store_tasks.process_event_from_reprocessing
    else:
        task = store_tasks.process_event

    task.delay(cache_key=cache_key, start_time=start_time, event_id=event_id)


def handle_save(message):
    data = message['data']
    event_id = data['event_id']
    cache_key = message['cache_key']
    start_time = message['start_time']
    project_id = data['project']

    store_tasks._do_save_event(cache_key, data, start_time, event_id, project_id)


dispatch = {}
for key, handler in (
    (settings.KAFKA_PREPROCESS, handle_preprocess),
    (settings.KAFKA_PROCESS, handle_process),
    (settings.KAFKA_SAVE, handle_save)
):
    topic = settings.KAFKA_TOPICS[key]['topic']
    dispatch[topic] = handler


def multiprocess_worker(task_queue):
    # Configure within each Process
    configured = False

    while True:
        task = task_queue.get()
        if task == _STOP_WORKER:
            task_queue.task_done()
            return

        # On first task, configure Sentry environment
        if not configured:
            from sentry.runner import configure
            configure()
            configured = True

        try:
            topic, payload = task
            handler = dispatch[topic]
            handler(json.loads(payload))
        finally:
            task_queue.task_done()


class ConsumerWorker(AbstractBatchWorker):
    def __init__(self, concurrency=2):
        from multiprocessing import Process, JoinableQueue as Queue

        self.pool = []
        self.task_queue = Queue(1000)
        for _ in xrange(concurrency):
            p = Process(target=multiprocess_worker, args=(self.task_queue,))
            p.daemon = True
            p.start()
            self.pool.append(p)

    def process_message(self, message):
        topic = message.topic()
        self.task_queue.put((topic, message.value()))

    def flush_batch(self, batch):
        # Batch flush is when Kafka offsets are committed. We await the completion
        # of all submitted tasks so that we don't publish offsets for anything
        # that hasn't been processed.
        self.task_queue.join()

    def shutdown(self):
        # Shut down our pool
        for _ in self.pool:
            self.task_queue.put(_STOP_WORKER)

        # And wait for it to drain
        for p in self.pool:
            p.join()
