from __future__ import absolute_import

import logging

from sentry.utils.services import Service
from sentry.tasks.post_process import post_process_group


logger = logging.getLogger(__name__)


class RelayNotRequired(NotImplementedError):
    """
    Exception raised if this backend does not require a relay process to
    enqueue post-processing tasks.
    """


class EventStream(Service):
    __all__ = (
        'insert',
        'start_delete_groups',
        'end_delete_groups',
        'start_merge',
        'end_merge',
        'start_unmerge',
        'end_unmerge',
        'relay',
    )

    def insert(self, group, event, is_new, is_sample, is_regression,
               is_new_group_environment, primary_hash, skip_consume=False):
        if skip_consume:
            logger.info('post_process.skip.raw_event', extra={'event_id': event.id})
        else:
            post_process_group.delay(
                group=group,
                event=event,
                is_new=is_new,
                is_sample=is_sample,
                is_regression=is_regression,
                is_new_group_environment=is_new_group_environment,
                primary_hash=primary_hash,
            )

    def start_delete_groups(self, project_id, group_ids):
        pass

    def end_delete_groups(self, state):
        pass

    def start_merge(self, project_id, previous_group_ids, new_group_id):
        pass

    def end_merge(self, state):
        pass

    def start_unmerge(self, project_id, hashes, previous_group_id, new_group_id):
        pass

    def end_unmerge(self, state):
        pass

    def relay(self, consumer_group, commit_log_topic,
              synchronize_commit_group, commit_batch_size=100, initial_offset_reset='latest'):
        raise RelayNotRequired
