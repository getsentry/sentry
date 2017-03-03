from __future__ import absolute_import

import functools

from sentry.utils.strings import (
    is_valid_dot_atom, iter_callsign_choices, soft_break, soft_hyphenate,
    tokens_from_name
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


def test_iter_callsign_choices():
    choices = iter_callsign_choices('FooBar')
    assert next(choices) == 'FB'
    assert next(choices) == 'FB2'
    assert next(choices) == 'FB3'
    assert next(choices) == 'FB4'

    choices = iter_callsign_choices('FooBarBaz')
    assert next(choices) == 'FBB'
    assert next(choices) == 'FBB2'
    assert next(choices) == 'FBB3'
    assert next(choices) == 'FBB4'

    choices = iter_callsign_choices('Grml')
    assert next(choices) == 'GR'
    assert next(choices) == 'GRM'
    assert next(choices) == 'GR2'
    assert next(choices) == 'GRM2'

    choices = iter_callsign_choices('42')
    assert next(choices) == 'PR'
    assert next(choices) == 'PR2'
    assert next(choices) == 'PR3'

    choices = iter_callsign_choices('GetHub')
    assert next(choices) == 'GH2'
    assert next(choices) == 'GH3'


def test_is_valid_dot_atom():
    assert is_valid_dot_atom('foo')
    assert is_valid_dot_atom('foo.bar')
    assert not is_valid_dot_atom('.foo.bar')
    assert not is_valid_dot_atom('foo.bar.')
    assert not is_valid_dot_atom('foo.\x00')
