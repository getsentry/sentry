"""
sentry.utils.stacks
~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

import inspect
import re

from django.utils.html import escape

from sentry.conf import settings
from sentry.utils import get_installed_apps, transform

def get_lines_from_file(filename, lineno, context_lines, loader=None, module_name=None):
    """
    Returns context_lines before and after lineno from file.
    Returns (pre_context_lineno, pre_context, context_line, post_context).
    """
    source = None
    if loader is not None and hasattr(loader, "get_source"):
        try:
            source = loader.get_source(module_name)
        except ImportError:
            # Traceback (most recent call last):
            #   File "/Users/dcramer/Development/django-sentry/sentry/client/handlers.py", line 31, in emit
            #     get_client().create_from_record(record, request=request)
            #   File "/Users/dcramer/Development/django-sentry/sentry/client/base.py", line 325, in create_from_record
            #     data['__sentry__']['frames'] = varmap(shorten, get_stack_info(stack))
            #   File "/Users/dcramer/Development/django-sentry/sentry/utils/stacks.py", line 112, in get_stack_info
            #     pre_context_lineno, pre_context, context_line, post_context = get_lines_from_file(filename, lineno, 7, loader, module_name)
            #   File "/Users/dcramer/Development/django-sentry/sentry/utils/stacks.py", line 24, in get_lines_from_file
            #     source = loader.get_source(module_name)
            #   File "/System/Library/Frameworks/Python.framework/Versions/2.7/lib/python2.7/pkgutil.py", line 287, in get_source
            #     fullname = self._fix_name(fullname)
            #   File "/System/Library/Frameworks/Python.framework/Versions/2.7/lib/python2.7/pkgutil.py", line 262, in _fix_name
            #     "module %s" % (self.fullname, fullname))
            # ImportError: Loader for module cProfile cannot handle module __main__
            source = None
        if source is not None:
            source = source.splitlines()
    if source is None:
        try:
            f = open(filename)
            try:
                source = f.readlines()
            finally:
                f.close()
        except (OSError, IOError):
            pass
    if source is None:
        return None, [], None, []

    encoding = 'ascii'
    for line in source[:2]:
        # File coding may be specified. Match pattern from PEP-263
        # (http://www.python.org/dev/peps/pep-0263/)
        match = re.search(r'coding[:=]\s*([-\w.]+)', line)
        if match:
            encoding = match.group(1)
            break
    source = [unicode(sline, encoding, 'replace') for sline in source]

    lower_bound = max(0, lineno - context_lines)
    upper_bound = lineno + context_lines

    pre_context = [line.strip('\n') for line in source[lower_bound:lineno]]
    context_line = source[lineno].strip('\n')
    post_context = [line.strip('\n') for line in source[lineno+1:upper_bound]]

    return lower_bound, pre_context, context_line, post_context

def get_culprit(frames):
    # We iterate through each frame looking for a deterministic culprit
    # When one is found, we mark it as last "best guess" (best_guess) and then
    # check it against SENTRY_EXCLUDE_PATHS. If it isnt listed, then we
    # use this option. If nothing is found, we use the "best guess".
    def contains(iterator, value):
        for k in iterator:
            if value.startswith(k):
                return True
        return False

    modules = get_installed_apps()
    if settings.INCLUDE_PATHS:
        modules = set(list(modules) + settings.INCLUDE_PATHS)

    best_guess = None
    for frame in frames:
        try:
            culprit = '.'.join([frame.f_globals['__name__'], frame.f_code.co_name])
        except:
            continue
        if contains(modules, culprit):
            if not (contains(settings.EXCLUDE_PATHS, culprit) and best_guess):
                best_guess = culprit
        elif best_guess:
            break

    return best_guess

def iter_traceback_frames(tb):
    while tb:
        # support for __traceback_hide__ which is used by a few libraries
        # to hide internal frames.
        if not tb.tb_frame.f_locals.get('__traceback_hide__'):
            yield tb.tb_frame
        tb = tb.tb_next

def iter_stack_frames():
    for frame_crud in inspect.stack()[1:]:
        yield frame_crud[0]

def get_stack_info(frames):
    results = []
    for frame in frames:
        # Support hidden frames
        if frame.f_locals.get('__traceback_hide__'):
            continue

        filename = frame.f_code.co_filename
        function = frame.f_code.co_name
        lineno = frame.f_lineno - 1
        loader = frame.f_globals.get('__loader__')
        module_name = frame.f_globals.get('__name__') or '?'
        pre_context_lineno, pre_context, context_line, post_context = get_lines_from_file(filename, lineno, 7, loader, module_name)
        if pre_context_lineno is not None:
            results.append({
                'id': id(frame),
                'filename': filename,
                'module': module_name,
                'function': function,
                'lineno': lineno + 1,
                # TODO: vars need to be references
                'vars': transform(frame.f_locals.items()),
                'pre_context': pre_context,
                'context_line': context_line,
                'post_context': post_context,
                'pre_context_lineno': pre_context_lineno + 1,
            })
    return results

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