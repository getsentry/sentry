import functools
from sentry.utils.strings import (
    soft_break,
    soft_hyphenate,
    tokens_from_name,
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


def test_tokens_from_name():
    assert list(tokens_from_name('MyHTTPProject42')) == [
        'my', 'http', 'project42']
    assert list(tokens_from_name('MyHTTPProject42', remove_digits=True)) == [
        'my', 'http', 'project']
    assert list(tokens_from_name('MyHTTPProject Awesome 42 Stuff')) == [
        'my', 'http', 'project', 'awesome', '42', 'stuff']
    assert list(tokens_from_name('MyHTTPProject Awesome 42 Stuff',
                                 remove_digits=True)) == [
        'my', 'http', 'project', 'awesome', 'stuff']
