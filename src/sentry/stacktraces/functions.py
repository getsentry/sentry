# coding: utf-8
from __future__ import absolute_import

import re


_windecl_hash = re.compile(r'^@?(.*?)@[0-9]+$')
_rust_hash = re.compile(r'::h[a-z0-9]{16}$')
_cpp_trailer_re = re.compile(r'(\bconst\b|&)$')


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
    """Given a function value from the frame's function attribute this returns
    a trimmed version that can be stored in `function_name`.  This is only used
    if the client did not supply a value itself already.
    """
    if platform not in ('objc', 'cocoa', 'swift', 'native', 'c'):
        return function
    if function in ('<redacted>', '<unknown>'):
        return function

    original_function = function
    function = function.strip()

    # Ensure we don't operated on objc functions
    if function.startswith(('[', '+[', '-[')):
        return function

    # Chop off C++ trailers
    while 1:
        match = _cpp_trailer_re.search(function)
        if match is None:
            break
        function = function[:match.start()].rstrip()

    # Because operator<< really screws with our balancing, so let's work
    # around that by replacing it with a character we do not observe in
    # `split_func_tokens` or `replace_enclosed_string`.
    function = function \
        .replace('operator<<', u'operator⟨⟨') \
        .replace('operator<', u'operator⟨') \
        .replace('operator()', u'operator◯')

    # Remove the arguments if there is one.
    def process_args(value, start):
        value = value.strip()
        if value in ('anonymous namespace', 'operator'):
            return '(%s)' % value
        return ''
    function = replace_enclosed_string(function, '(', ')', process_args)

    # Resolve generic types, but special case rust which uses things like
    # <Foo as Bar>::baz to denote traits.
    def process_generics(value, start):
        # Rust special case
        if start == 0:
            return '<%s>' % replace_enclosed_string(value, '<', '>', process_generics)
        return '<T>'
    function = replace_enclosed_string(function, '<', '>', process_generics)

    # The last token is the function name.
    tokens = split_func_tokens(function)
    if tokens:
        function = tokens[-1].replace(u'⟨', '<').replace(u'◯', '()')

    # This really should never happen
    else:
        function = original_function

    # trim off rust markers
    function = _rust_hash.sub('', function)

    # trim off windows decl markers
    return _windecl_hash.sub('\\1', function)


def get_function_name_for_frame(frame, platform=None):
    """Given a frame object or dictionary this returns the actual function
    name trimmed.
    """
    if hasattr(frame, 'get_raw_data'):
        frame = frame.get_raw_data()
    rv = frame.get('function_name')
    if rv:
        return rv
    rv = frame.get('function')
    if rv:
        return trim_function_name(rv, frame.get('platform') or platform)
