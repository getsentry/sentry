import logging

from sentry.tasks.post_process import post_process_group
from sentry.utils.services import Service
from sentry.utils.cache import cache_key_for_event


logger = logging.getLogger(__name__)


class ForwarderNotRequired(NotImplementedError):
    """
    Exception raised if this backend does not require a forwarder process to
    enqueue post-processing tasks.
    """


class EventStream(Service):
    __all__ = (
        "insert",
        "start_delete_groups",
        "end_delete_groups",
        "start_merge",
        "end_merge",
        "start_unmerge",
        "end_unmerge",
        "start_delete_tag",
        "end_delete_tag",
        "tombstone_events_unsafe",
        "replace_group_unsafe",
        "exclude_groups",
        "requires_post_process_forwarder",
        "run_post_process_forwarder",
    )

    def _dispatch_post_process_group_task(
        self,
        event,
        is_new,
        is_regression,
        is_new_group_environment,
        primary_hash,
        skip_consume=False,
    ):
        if skip_consume:
            logger.info("post_process.skip.raw_event", extra={"event_id": event.event_id})
        else:
            cache_key = cache_key_for_event(
                {"project": event.project_id, "event_id": event.event_id}
            )
            post_process_group.delay(
                is_new=is_new,
                is_regression=is_regression,
                is_new_group_environment=is_new_group_environment,
                primary_hash=primary_hash,
                cache_key=cache_key,
                group_id=event.group_id,
            )

    def insert(
        self,
        group,
        event,
        is_new,
        is_regression,
        is_new_group_environment,
        primary_hash,
        received_timestamp,  # type: float
        skip_consume=False,
    ):
        self._dispatch_post_process_group_task(
            event, is_new, is_regression, is_new_group_environment, primary_hash, skip_consume
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

    def start_delete_tag(self, project_id, tag):
        pass

    def end_delete_tag(self, state):
        pass

    def tombstone_events_unsafe(
        self, project_id, event_ids, old_primary_hash=False, from_timestamp=None, to_timestamp=None
    ):
        pass

    def replace_group_unsafe(self, project_id, event_ids, new_group_id):
        pass

    def exclude_groups(self, project_id, group_ids):
        pass

    def requires_post_process_forwarder(self):
        return False

    def run_post_process_forwarder(
        self,
        consumer_group,
        commit_log_topic,
        synchronize_commit_group,
        commit_batch_size=100,
        initial_offset_reset="latest",
    ):
        assert not self.requires_post_process_forwarder()
        raise ForwarderNotRequired
