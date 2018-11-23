from __future__ import absolute_import

from sentry.eventstream.base import EventStream
from sentry.utils import snuba


class SnubaEventStream(EventStream):
    def insert(self, group, event, is_new, is_sample, is_regression,
               is_new_group_environment, primary_hash, skip_consume=False):
        snuba.insert_raw([{
            'group_id': event.group_id,
            'event_id': event.event_id,
            'project_id': event.project_id,
            # TODO(mitsuhiko): We do not want to send this incorrect
            # message but this is what snuba needs at the moment.
            'message': event.message,
            'platform': event.platform,
            'datetime': event.datetime,
            'data': dict(event.data.items()),
            'primary_hash': primary_hash,
        }])
        super(SnubaEventStream, self).insert(
            group, event, is_new, is_sample,
            is_regression, is_new_group_environment,
            primary_hash, skip_consume
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
