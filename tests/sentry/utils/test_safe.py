from __future__ import absolute_import

from sentry.testutils import TestCase
from sentry.utils.safe import safe_execute, trim, trim_dict

a_very_long_string = 'a' * 1024


class TrimTest(TestCase):
    def test_simple_string(self):
        assert trim(a_very_long_string) == a_very_long_string[:509] + '...'

    def test_list_of_strings(self):
        assert trim([a_very_long_string, a_very_long_string]) == [
            a_very_long_string[:507] + '...',
        ]

    def test_nonascii(self):
        assert trim({'x': '\xc3\xbc'}) == {'x': '\xc3\xbc'}
        assert trim(['x', '\xc3\xbc']) == ['x', '\xc3\xbc']


class TrimDictTest(TestCase):
    def test_large_dict(self):
        value = dict((k, k) for k in range(500))
        trim_dict(value)
        assert len(value) == 50


class SafeExecuteTest(TestCase):
    def test_with_nameless_function(self):
        assert safe_execute(lambda a: a, 1) == 1
        assert safe_execute(lambda: a) is None  # NOQA

    def test_with_simple_function(self):
        def simple(a):
            return a

        assert safe_execute(simple, 1) == 1

        def simple(a):
            raise Exception()

        assert safe_execute(simple, 1) is None

    def test_with_instance_method(self):
        class Foo(object):
            def simple(self, a):
                return a

        assert safe_execute(Foo().simple, 1) == 1

        class Foo(object):
            def simple(self, a):
                raise Exception()

        assert safe_execute(Foo().simple, 1) is None
