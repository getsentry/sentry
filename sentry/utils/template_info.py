from django.utils.html import escape

def get_template_info(template_info, exc_value=None):
    template_source, start, end, name = template_info
    context_lines = 10
    line = 0
    upto = 0
    source_lines = []
    before = during = after = ""
    for num, next in enumerate(linebreak_iter(template_source)):
        if start >= upto and end <= next:
            line = num
            before = escape(template_source[upto:start])
            during = escape(template_source[start:end])
            after = escape(template_source[end:next])
        source_lines.append((num, escape(template_source[upto:next])))
        upto = next
    total = len(source_lines)

    top = max(1, line - context_lines)
    bottom = min(total, line + 1 + context_lines)

    return {
        'message': exc_value and exc_value.args[0] or None,
        'source_lines': source_lines[top:bottom],
        'before': before,
        'during': during,
        'after': after,
        'top': top,
        'bottom': bottom,
        'total': total,
        'line': line,
        'name': name,
    }

def linebreak_iter(template_source):
    yield 0
    p = template_source.find('\n')
    while p >= 0:
        yield p+1
        p = template_source.find('\n', p+1)
    yield len(template_source) + 1