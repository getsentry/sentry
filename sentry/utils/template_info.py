"""
sentry.utils.template_info
~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2012 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""


def linebreak_iter(template_source):
    yield 0
    p = template_source.find('\n')
    while p >= 0:
        yield p + 1
        p = template_source.find('\n', p + 1)
    yield len(template_source) + 1


def get_template_info(template_info):
    source, start, end, name = template_info

    lineno = None
    upto = 0
    source_lines = []
    for num, next in enumerate(linebreak_iter(source)):
        if start >= upto and end <= next:
            lineno = num
        source_lines.append((num, source[upto:next]))
        upto = next

    if not source_lines or lineno is None:
        return {}

    pre_context = source_lines[max(lineno - 3, 0):lineno]
    post_context = source_lines[(lineno + 1):(lineno + 4)]
    context_line = source_lines[lineno][1]

    return {
        'filename': name,
        'pre_context': pre_context,
        'context_line': context_line,
        'lineno': lineno,
        'post_context': post_context,
    }
