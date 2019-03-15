from __future__ import absolute_import

from sentry.grouping.component import GroupingComponent
from sentry.grouping.strategies.base import strategy


@strategy(
    id='single-exception:v1',
    interfaces=['singleexception'],
    variants=['!system', 'app'],
)
def single_exception_v1(exception, config, **meta):
    type_component = GroupingComponent(
        id='type',
        values=[exception.type] if exception.type else [],
    )

    if exception.stacktrace is not None:
        stacktrace_component = config.get_grouping_component(
            exception.stacktrace, **meta)
    else:
        stacktrace_component = GroupingComponent(id='stacktrace')

    return GroupingComponent(
        id='exception',
        values=[
            stacktrace_component,
            type_component,
        ]
    )


@strategy(
    id='chained-exception:v1',
    interfaces=['exception'],
    variants=['!system', 'app'],
    score=2000,
)
def chained_exception_v1(chained_exception, config, **meta):
    # Case 1: we have a single exception, use the single exception
    # component directly to avoid a level of nesting
    exceptions = chained_exception.exceptions()
    if len(exceptions) == 1:
        return config.get_grouping_component(exceptions[0], **meta)

    values = []
    for exception in exceptions:
        values.append(config.get_grouping_component(exception, **meta))

    return GroupingComponent(
        id='chained-exception',
        values=values,
    )
