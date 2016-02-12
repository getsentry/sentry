import functools
from sentry.utils.strings import (
    soft_break,
    soft_hyphenate,
)


ZWSP = u'\u200b'  # zero width space
SHY = u'\u00ad'  # soft hyphen


def test_soft_break():
    assert soft_break('com.example.package.method(argument).anotherMethod(argument)', 15) == \
        ZWSP.join(['com.', 'example.', 'package.', 'method(', 'argument).', 'anotherMethod(', 'argument)'])


def test_soft_break_and_hyphenate():
    hyphenate = functools.partial(soft_hyphenate, length=6)
    assert soft_break('com.reallyreallyreally.long.path', 6, hyphenate) == \
        ZWSP.join(['com.', SHY.join(['really'] * 3) + '.', 'long.', 'path'])
