from __future__ import absolute_import

from StringIO import StringIO

from sentry.lang.java.proguard.parser import (
    Class, Field, Method, parse_file, parse_line
)


def test_parse_line():
    assert parse_line('com.getsentry.example.Dad -> a:') == Class('com.getsentry.example.Dad', 'a')
    assert parse_line('Dad dad -> a') == Field('Dad', 'dad', 'a')
    assert parse_line('void <init>() -> <init>') == Method(None, None, 'void', '<init>', '', '<init>')
    assert parse_line('void quack() -> a') == Method(None, None, 'void', 'quack', '', 'a')
    assert parse_line('5:10:void quack(int) -> a') == Method(5, 10, 'void', 'quack', 'int', 'a')
    assert parse_line('    5:10:void quack(int,int) -> a') == Method(5, 10, 'void', 'quack', 'int,int', 'a')


mapping = """\
com.getsentry.example.Duck -> a.a.a:
    Hat hat -> a
    0:1:void <init>() -> <init>
    3:5:com.getsentry.example.Hat getHat() -> a
    7:11:void setHat(com.getsentry.example.Hat) -> b
    12:20:void quack() -> c
com.getsentry.example.Hat -> a.a.b:
    0:1:void <init>() -> <init>
"""

expected = [
    (Class('com.getsentry.example.Duck', 'a.a.a'), [
        Field('Hat', 'hat', 'a'),
        Method(0, 1, 'void', '<init>', '', '<init>'),
        Method(3, 5, 'com.getsentry.example.Hat', 'getHat', '', 'a'),
        Method(7, 11, 'void', 'setHat', 'com.getsentry.example.Hat', 'b'),
        Method(12, 20, 'void', 'quack', '', 'c'),
    ]),
    (Class('com.getsentry.example.Hat', 'a.a.b'), [
        Method(0, 1, 'void', '<init>', '', '<init>'),
    ]),
]


def test_reader():
    f = StringIO(mapping)
    for i, (cls, members) in enumerate(parse_file(f)):
        assert cls == expected[i][0]
        assert list(members) == expected[i][1]

    assert len(expected) == i + 1
