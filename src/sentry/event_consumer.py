from __future__ import absolute_import, print_function

import logging

from batching_kafka_consumer import AbstractBatchWorker

from sentry.coreapi import APIForbidden, APIRateLimited, Auth, ClientApiHelper
from sentry.event_manager import EventManager
from sentry.models import Project
from sentry.utils import json
from sentry.web.api import process_event


logger = logging.getLogger('sentry.event_consumer')


def process_event_from_kafka(message):
    project = Project.objects.get_from_cache(pk=message['project_id'])

    remote_addr = message['remote_addr']
    helper = ClientApiHelper(
        agent=message['agent'],
        project_id=project.id,
        ip_address=remote_addr,
    )
    helper.context.bind_project(project)

    auth = Auth(message['auth'], message['auth'].pop('is_public'))
    helper.context.bind_auth(auth)

    key = helper.project_key_from_auth(auth)
    data = message['data']
    version = data['version']

    event_manager = EventManager(
        data,
        project=project,
        key=key,
        auth=auth,
        client_ip=remote_addr,
        user_agent=helper.context.agent,
        version=version,
    )
    event_manager._normalized = True
    del data

    return process_event(event_manager, project, key,
                         remote_addr, helper, attachments=None)


class EventConsumerWorker(AbstractBatchWorker):
    def process_message(self, message):
        value = json.loads(message.value())
        if value.get('should_process', False):
            try:
                process_event_from_kafka(value)
            except APIForbidden:
                # Filtered or duplicate.
                pass
            except APIRateLimited:
                # TODO: Shared state so StoreView/Relay can return proper
                # status code and Retry-After.
                pass
            except Exception:
                logger.exception('Error processing event.')

        # TODO: The BatchingKafkaConsumer API only flushes batches (and Kafka offsets)
        # if there are non-None values returned from `process_message` that should be
        # flushed. However, our existing code doesn't operate on batches, so we eagerly
        # process them as soon as they are received from Kafka, and return True so that
        # there is something in the batch for the BatchingKafkaConsumer to flush (along
        # with offsets). We should maybe improve the BatchingKafkaConsumer API to allow
        # for flushing consumed offsets without having to "fake" a batch.
        # Note that the BatchingKafkaConsumer is still useful to use because it allows
        # full control over when and how often to commit offsets, in addition to retries
        # of those commits and unified configuration of consumers.
        return True

    def flush_batch(self, batch):
        pass

    def shutdown(self):
        pass
