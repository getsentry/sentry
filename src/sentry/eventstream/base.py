from __future__ import absolute_import

from sentry.utils.services import Service

from sentry.tasks.post_process import post_process_group


class EventStream(Service):
    __all__ = (
        'publish',
    )

    def publish(self, group, event, is_new, is_sample, is_regression, is_new_group_environment, primary_hash, skip_consume=False):
        if not skip_consume:
            post_process_group.delay(
                group=group,
                event=event,
                is_new=is_new,
                is_sample=is_sample,
                is_regression=is_regression,
                is_new_group_environment=is_new_group_environment,
                primary_hash=primary_hash,
            )
