from __future__ import absolute_import

import re

from sentry.utils.safe import get_path


SYSTEM_FRAMES = [
    "std::",
    "core::",
    "alloc::",
    "backtrace::",
    "failure::",
    # these are not modules but things like __rust_maybe_catch_panic
    "__rust_",
    "___rust_",
]

OUTER_BORDER_FRAMES = [
    "_ffi_call",
]

INNER_BORDER_FRAMES = [
    "std::panicking::begin_panic",
    "failure::error_message::err_msg",
    "failure::backtrace::Backtrace::new",
]

FRAME_RE = re.compile(r'''(?xm)
    ^
        [\ ]*(?:\d+:)[\ ]*                  # leading frame number
        (?P<addr>0x[a-f0-9]+)               # addr
        [\ ]-[\ ]
        (?P<symbol>[^\r\n]+)
        (?:
            \r?\n
            [\ \t]+at[\ ]
            (?P<path>[^\r\n]+?)
            (?::(?P<lineno>\d+))?
        )?
    $
''')

HASH_FUNC_RE = re.compile(r'''(?x)
    ^(.*)::h[a-f0-9]{16}$
''')

PATTERN_MATCH_RE = re.compile(r'^(_?\<)+')

RUST_CRATE_RE = re.compile(r'^(?:_?<)?([a-zA-Z0-9_]+?)(?:\.\.|::)')

RUST_ESCAPES_RE = re.compile(r'''(?x)
    \$
        (SP|BP|RF|LT|GT|LP|RP|C|
            u7e|u20|u27|u5b|u5d|u7b|u7d|u3b|u2b|u22)
    \$
''')

RUST_ESCAPES = {
    'SP': '@',
    'BP': '*',
    'RF': '&',
    'LT': '<',
    'GT': '>',
    'LP': '(',
    'RP': ')',
    'C': ',',
    'u7e': '~',
    'u20': ' ',
    'u27': '\'',
    'u5b': '[',
    'u5d': ']',
    'u7b': '{',
    'u7d': '}',
    'u3b': ';',
    'u2b': '+',
    'u22': '"',
}


def get_filename(abs_path):
    return abs_path \
        .rsplit('/', 1)[-1] \
        .rsplit('\\', 1)[-1]


def strip_symbol(symbol):
    if symbol:
        match = HASH_FUNC_RE.match(symbol)
        if match:
            return match.group(1)

    return symbol


def demangle_rust(symbol):
    return RUST_ESCAPES_RE.sub(
        lambda m: RUST_ESCAPES.get(m.group(1), ''),
        symbol,
    )


def starts_with(function, pattern):
    return PATTERN_MATCH_RE \
        .sub('', function) \
        .replace('.', ':') \
        .startswith(pattern)


def matches_frame(function, patterns):
    return any(starts_with(function, p) for p in patterns)


def frame_from_match(match):
    symbol = strip_symbol(match.group('symbol'))
    function = demangle_rust(symbol)

    frame = {
        'function': function,
        'in_app': not matches_frame(function, SYSTEM_FRAMES),
        'instruction_addr': match.group('addr'),
    }

    if symbol != function:
        frame['symbol'] = symbol

    package = RUST_CRATE_RE.match(function)
    if package and package.group(1):
        frame['package'] = package.group(1)

    path = match.group('path')
    if path:
        frame['abs_path'] = path
        frame['filename'] = get_filename(path)

    lineno = match.group('lineno')
    if lineno:
        lineno = int(lineno)
    if lineno:
        frame['lineno'] = lineno

    return frame


def frames_from_rust_info(rust_info):
    frames = [frame_from_match(m) for m in FRAME_RE.finditer(rust_info)]

    end = next((
        i for i, f in enumerate(frames)
        if matches_frame(f['function'], OUTER_BORDER_FRAMES)
    ), len(frames))

    start = -next((
        i for i, f in enumerate(reversed(frames))
        if matches_frame(f['function'], INNER_BORDER_FRAMES)
    ), 0)

    return frames[start:end]


def strip_backtrace_message(target, field):
    if target and target.get('field'):
        target['field'] = target['field'].split('\n\n', 1)[0]


def merge_rust_info_frames(event, hint):
    if 'exc_info' not in hint:
        return event

    exc_type, exc_value, tb = hint['exc_info']
    if not hasattr(exc_value, 'rust_info') or not exc_value.rust_info:
        return event

    exception = get_path(event, 'exception', 'values', 0)
    stacktrace = get_path(exception, 'stacktrace', 'frames')
    if not stacktrace:
        return

    frames = frames_from_rust_info(exc_value.rust_info)
    if not frames:
        return

    # Update the platform
    event['platform'] = 'native'
    for frame in stacktrace:
        frame['platform'] = 'python'

    # Extend the stacktrace
    stacktrace.extend(reversed(frames))

    # Remove rust_info from messages
    strip_backtrace_message(exception, 'value')
    strip_backtrace_message(event.get('logentry'), 'message')
    strip_backtrace_message(event.get('logentry'), 'formatted')

    return event
