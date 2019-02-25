from __future__ import absolute_import, print_function

from batching_kafka_consumer import AbstractBatchWorker

from django.conf import settings

import sentry.tasks.store as store_tasks
from sentry.utils import json


class ConsumerWorker(AbstractBatchWorker):
    def __init__(self):
        self.preprocess_topic = settings.KAFKA_TOPICS[settings.KAFKA_PREPROCESS]['topic']
        self.process_topic = settings.KAFKA_TOPICS[settings.KAFKA_PROCESS]['topic']
        self.save_topic = settings.KAFKA_TOPICS[settings.KAFKA_SAVE]['topic']

    def process_message(self, message):
        value = json.loads(message.value())
        topic = message.topic()

        # from pprint import pprint
        # print("topic: %s" % topic)
        # pprint(value)
        # print("\n\n\n")

        if topic == self.preprocess_topic:
            data = value['data']
            event_id = data['event_id']
            cache_key = value['attachments_cache_key']
            start_time = value['start_time']
            process_task = (
                store_tasks.process_event_from_reprocessing
                if value['from_reprocessing']
                else store_tasks.process_event
            )

            store_tasks._do_preprocess_event(cache_key, data, start_time, event_id, process_task)
        elif topic == self.process_topic:
            data = value['data']
            event_id = data['event_id']
            cache_key = value['attachments_cache_key']
            start_time = value['start_time']
            process_task = (
                store_tasks.process_event_from_reprocessing
                if value['from_reprocessing']
                else store_tasks.process_event
            )

            store_tasks._do_process_event(cache_key, start_time, event_id, process_task, data=data)
        elif topic == self.save_topic:
            data = value['data']
            event_id = data['event_id']
            cache_key = value['attachments_cache_key']
            start_time = value['start_time']
            project_id = data['project']

            store_tasks.save_event(cache_key, data, start_time, event_id, project_id)
        else:
            raise RuntimeError("Message from unknown topic?")

    def flush_batch(self, batch):
        pass

    def shutdown(self):
        pass
