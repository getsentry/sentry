from __future__ import absolute_import

import six


PAIRS = {
    '(': ')',
    '{': '}',
    '[': ']',
    '<': '>',
}


def replace_enclosed_string(s, start, end, replacement=None):
    if start not in s:
        return s

    depth = 0

    rv = []
    pair_start = None
    for idx, char in enumerate(s):
        if char == start:
            if depth == 0:
                pair_start = idx
            depth += 1
        elif char == end:
            depth -= 1
            if depth == 0:
                if replacement is not None:
                    if callable(replacement):
                        rv.append(replacement(s[pair_start + 1:idx], pair_start))
                    else:
                        rv.append(replacement)
        elif depth == 0:
            rv.append(char)

    return ''.join(rv)


def split_func_tokens(s):
    buf = []
    rv = []
    stack = []
    end = 0

    for idx, char in enumerate(s):
        if char in PAIRS:
            stack.append(PAIRS[char])
        elif stack and char == stack[-1]:
            stack.pop()
            if not stack:
                buf.append(s[end:idx + 1])
                end = idx + 1
        elif not stack:
            if char.isspace():
                if buf:
                    rv.append(buf)
                buf = []
            else:
                buf.append(s[end:idx + 1])
            end = idx + 1

    if buf:
        rv.append(buf)

    return [''.join(x) for x in rv]


def trim_function_name(function, platform):
    """This works similar to `get_function_component_v1` but returns a
    string in all situations that was just trimmed.  This function is supposed
    to be used for display purposes in the UI.

    The return value of this function does not need to be kept stable so it
    can be upgraded without breaking grouping.
    """
    from sentry.grouping.strategies.newstyle import get_function_component_v1
    component = get_function_component_v1(function, platform)
    if len(component.values) == 1 and isinstance(component.values[0], six.string_types):
        return component.values[0]
    return function


def remove_non_stacktrace_variants(variants):
    """This is a utility function that when given multiple variants will
    mark all variants as non contributing that do not contain any stacktraces
    if any of the other variants contain a stacktrace that contributes.
    """
    if len(variants) <= 1:
        return variants
    any_stacktrace_contributes = False
    non_contributing_components = []
    stacktrace_variants = set()

    # In case any of the variants has a contributing stacktrace, we want
    # to make all other variants non contributing.
    for key, component in six.iteritems(variants):
        stacktrace_iter = component.iter_subcomponents(
            id='stacktrace',
            recursive=True,
            only_contributing=True
        )
        if next(stacktrace_iter, None) is not None:
            any_stacktrace_contributes = True
            stacktrace_variants.add(key)
        else:
            non_contributing_components.append(component)

    if any_stacktrace_contributes:
        if len(stacktrace_variants) == 1:
            hint_suffix = 'the %s variant does' % next(iter(stacktrace_variants))
        else:
            # this branch is basically dead because we only have two
            # variants right now, but this is so this does not break in
            # the future.
            hint_suffix = 'others do'
        for component in non_contributing_components:
            component.update(
                contributes=False,
                hint='ignored because this variant does not have a contributing '
                'stacktrace, but %s' % hint_suffix
            )

    return variants
