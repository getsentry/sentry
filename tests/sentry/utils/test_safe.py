from __future__ import absolute_import

from collections import OrderedDict
from functools import partial

from sentry.testutils import TestCase
from sentry.utils.canonical import CanonicalKeyDict
from sentry.utils.safe import safe_execute, trim, trim_dict, get_path

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

    def test_idempotent(self):
        trm = partial(trim, max_depth=2)
        a = {'a': {'b': {'c': {'d': 1}}}}
        assert trm(a) == {'a': {'b': {'c': '{"d":1}'}}}
        assert trm(trm(trm(trm(a)))) == trm(a)

    def test_sorted_trim(self):
        # Trim should always trim the keys in alpha order
        # regardless of the original order.
        alpha = OrderedDict([('a', '12345'), ('z', '12345')])
        reverse = OrderedDict([('z', '12345'), ('a', '12345')])
        trm = partial(trim, max_size=12)
        expected = {'a': '12345', 'z': '1...'}

        assert trm(alpha) == expected
        assert trm(reverse) == expected

    def test_max_depth(self):
        trm = partial(trim, max_depth=2)
        a = {'a': {'b': {'c': 'd'}}}
        assert trm(a) == a

        a = {'a': {'b': {'c': u'd'}}}
        assert trm(a) == {'a': {'b': {'c': 'd'}}}

        a = {'a': {'b': {'c': {u'd': u'e'}}}}
        assert trm(a) == {'a': {'b': {'c': '{"d":"e"}'}}}

        a = {'a': {'b': {'c': []}}}
        assert trm(a) == {'a': {'b': {'c': '[]'}}}


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


class GetChainTest(TestCase):
    def test_get_path(self):
        assert get_path({}, ['a']) is None
        assert get_path({}, ['a'], 1) == 1
        assert get_path({'a': 2}, ['a']) == 2
        assert get_path({'a': 2}, ['b']) is None
        assert get_path({'a': 2}, ['b'], 1) == 1
        assert get_path({'a': {'b': []}}, ['a', 'b']) == []
        assert get_path({'a': []}, ['a', 'b']) is None
        assert get_path(CanonicalKeyDict({'a': 2}), ['a']) == 2
