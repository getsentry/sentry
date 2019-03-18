from __future__ import absolute_import

import six

from sentry.grouping.component import GroupingComponent
from sentry.grouping.strategies.base import strategy


@strategy(
    id='single-exception:legacy',
    interfaces=['singleexception'],
    variants=['!system', 'app'],
)
def single_exception_legacy(exception, config, **meta):
    type_component = GroupingComponent(
        id='type',
        values=[exception.type] if exception.type else [],
        contributes=False
    )
    value_component = GroupingComponent(
        id='value',
        values=[exception.value] if exception.value else [],
        contributes=False
    )
    stacktrace_component = GroupingComponent(id='stacktrace')

    if exception.stacktrace is not None:
        stacktrace_component = config.get_grouping_component(
            exception.stacktrace, **meta)
        if stacktrace_component.contributes:
            if exception.type:
                type_component.update(contributes=True)
                if exception.value:
                    value_component.update(hint='stacktrace and type take precedence')
            elif exception.value:
                value_component.update(hint='stacktrace takes precedence')

    if not stacktrace_component.contributes:
        if exception.type:
            type_component.update(contributes=True)
        if exception.value:
            value_component.update(contributes=True)

    return GroupingComponent(
        id='exception',
        values=[
            stacktrace_component,
            type_component,
            value_component,
        ]
    )


@strategy(
    id='chained-exception:legacy',
    interfaces=['exception'],
    variants=['!system', 'app'],
    score=2000,
)
def chained_exception_legacy(chained_exception, config, **meta):
    # Case 1: we have a single exception, use the single exception
    # component directly
    exceptions = chained_exception.exceptions()
    if len(exceptions) == 1:
        return config.get_grouping_component(exceptions[0], **meta)

    # Case 2: try to build a new component out of the individual
    # errors however with a trick.  In case any exeption has a
    # stacktrace we want to ignore all other exceptions.
    any_stacktraces = False
    values = []
    for exception in exceptions:
        exception_component = config.get_grouping_component(exception, **meta)
        stacktrace_component = exception_component.get_subcomponent('stacktrace')
        if stacktrace_component is not None and \
           stacktrace_component.contributes:
            any_stacktraces = True
        values.append(exception_component)

    if any_stacktraces:
        for value in values:
            stacktrace_component = value.get_subcomponent('stacktrace')
            if stacktrace_component is None or not stacktrace_component.contributes:
                value.update(
                    contributes=False,
                    hint='exception has no stacktrace',
                )

    return GroupingComponent(
        id='chained-exception',
        values=values,
    )


@chained_exception_legacy.variant_processor
def chained_exception_legacy_variant_processor(variants, config, **meta):
    if len(variants) <= 1:
        return variants
    any_stacktrace_contributes = False
    non_contributing_components = []
    stacktrace_variants = set()

    # In case any of the variants has a contributing stacktrace, we want
    # to make all other variants non contributing.  Thr e
    for (key, component) in six.iteritems(variants):
        if any(s.contributes for s in component.iter_subcomponents(
                id='stacktrace', recursive=True)):
            any_stacktrace_contributes = True
            stacktrace_variants.add(key)
        else:
            non_contributing_components.append(component)

    if any_stacktrace_contributes:
        if len(stacktrace_variants) == 1:
            hint_suffix = 'but the %s variant does' % next(iter(stacktrace_variants))
        else:
            # this branch is basically dead because we only have two
            # variants right now, but this is so this does not break in
            # the future.
            hint_suffix = 'others do'
        for component in non_contributing_components:
            component.update(
                contributes=False,
                hint='ignored because this variant does not contain a '
                'stacktrace, but %s' % hint_suffix
            )

    return variants
