from __future__ import absolute_import

from sentry.grouping.component import GroupingComponent
from sentry.grouping.strategies.base import strategy


@strategy(
    id='message:v1',
    interfaces=['message'],
    variants=['default'],
    score=0,
)
def message_v1(message_interface, **meta):
    return GroupingComponent(
        id='message',
        values=[message_interface.message or message_interface.formatted],
    )
