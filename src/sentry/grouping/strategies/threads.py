from __future__ import absolute_import

from sentry.grouping.component import GroupingComponent
from sentry.grouping.strategies.base import strategy


@strategy(
    id='threads:v1',
    interfaces=['threads'],
    variants=['!system', 'app'],
    score=1900,
)
def threads_v1(threads_interface, config, **meta):
    thread_count = len(threads_interface.values)
    if thread_count != 1:
        return GroupingComponent(
            id='threads',
            contributes=False,
            hint='ignored because contains %d threads' % thread_count,
        )

    stacktrace = threads_interface.values[0].get('stacktrace')
    if not stacktrace:
        return GroupingComponent(
            id='threads',
            contributes=False,
            hint='thread has no stacktrace',
        )

    return GroupingComponent(
        id='threads',
        values=[config.get_grouping_component(stacktrace, **meta)],
    )
