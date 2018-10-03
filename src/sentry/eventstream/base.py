from __future__ import absolute_import

import logging

from sentry.utils.services import Service
from sentry.tasks.post_process import post_process_group


logger = logging.getLogger(__name__)


class EventStream(Service):
    __all__ = (
        'insert',
        'unmerge',
        'delete_groups',
        'merge',
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

    def unmerge(self, project_id, new_group_id, event_ids):
        pass

    def delete_groups(self, project_id, group_ids):
        pass

    def merge(self, project_id, previous_group_id, new_group_id):
        pass
