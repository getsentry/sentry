# -*- coding: utf-8 -*-

from __future__ import absolute_import

from exam import fixture

from sentry.interfaces.base import InterfaceValidationError
from sentry.interfaces.http import Http
from sentry.testutils import TestCase


class HttpTest(TestCase):
    @fixture
    def interface(self):
        return Http.to_python(dict(
            url='http://example.com',
        ))

    def test_path(self):
        assert self.interface.get_path() == 'sentry.interfaces.Http'

    def test_serialize_unserialize_behavior(self):
        result = type(self.interface).to_python(self.interface.to_json())
        assert result.to_json() == self.interface.to_json()

    def test_basic(self):
        result = self.interface
        assert result.url == 'http://example.com'
        assert result.method is None
        assert result.fragment == ''
        assert result.query_string == ''
        assert result.data is None
        assert result.cookies == []
        assert result.headers == []
        assert result.env == {}
        assert result.full_url == result.url

    def test_full(self):
        result = Http.to_python(dict(
            method='GET',
            url='http://example.com',
            query_string='foo=bar',
            fragment='foobar',
            headers={'x-foo-bar': 'baz'},
            cookies={'foo': 'bar'},
            env={'bing': 'bong'},
            data='hello world',
        ))
        assert result.method == 'GET'
        assert result.query_string == 'foo=bar'
        assert result.fragment == 'foobar'
        assert result.cookies == [('foo', 'bar')]
        assert result.headers == [('X-Foo-Bar', 'baz')]
        assert result.env == {'bing': 'bong'}
        assert result.data == 'hello world'

    def test_query_string_as_dict(self):
        result = Http.to_python(dict(
            url='http://example.com',
            query_string={'foo': 'bar'},
        ))
        assert result.query_string == 'foo=bar'

    def test_query_string_as_dict_unicode(self):
        result = Http.to_python(dict(
            url='http://example.com',
            query_string={'foo': u'\N{SNOWMAN}'},
        ))
        assert result.query_string == 'foo=%E2%98%83'

    def test_data_as_dict(self):
        result = Http.to_python(dict(
            url='http://example.com',
            data={'foo': 'bar'},
        ))
        assert result.data == '{"foo":"bar"}'

    def test_form_encoded_data(self):
        result = Http.to_python(dict(
            url='http://example.com',
            headers={'Content-Type': 'application/x-www-form-urlencoded'},
            data='foo=bar',
        ))
        assert result.data == 'foo=bar'

    def test_cookies_as_string(self):
        result = Http.to_python(dict(
            url='http://example.com',
            cookies='a=b;c=d',
        ))
        assert result.cookies == [('a', 'b'), ('c', 'd')]
        result = Http.to_python(dict(
            url='http://example.com',
            cookies='a=b&c=d',
        ))
        assert result.cookies == [('a', 'b'), ('c', 'd')]

    def test_cookies_in_header(self):
        result = Http.to_python(dict(
            url='http://example.com',
            headers={'Cookie': 'a=b;c=d'},
        ))
        assert result.cookies == [('a', 'b'), ('c', 'd')]
        result = Http.to_python(dict(
            url='http://example.com',
            headers={'Cookie': 'a=b;c=d'},
            cookies={'foo': 'bar'},
        ))
        assert result.cookies == [('foo', 'bar')]

    def test_query_string_and_fragment_as_params(self):
        result = Http.to_python(dict(
            url='http://example.com',
            query_string='foo=bar',
            fragment='fragment',
        ))
        assert result.url == 'http://example.com'
        assert result.full_url == 'http://example.com?foo=bar#fragment'

    def test_query_string_and_fragment_in_url(self):
        result = Http.to_python(dict(
            url='http://example.com?foo=bar#fragment',
        ))
        assert result.url == 'http://example.com'
        assert result.full_url == 'http://example.com?foo=bar#fragment'

    def test_header_value_list(self):
        result = Http.to_python(dict(
            url='http://example.com',
            headers={'Foo': ['1', '2']},
        ))
        assert result.headers == [('Foo', '1, 2')]

    def test_header_value_str(self):
        result = Http.to_python(dict(
            url='http://example.com',
            headers={'Foo': 1}
        ))
        assert result.headers == [('Foo', '1')]

    def test_method(self):
        with self.assertRaises(InterfaceValidationError):
            Http.to_python(dict(
                url='http://example.com',
                method='1234',
            ))

        with self.assertRaises(InterfaceValidationError):
            Http.to_python(dict(
                url='http://example.com',
                method='A' * 33,
            ))

        with self.assertRaises(InterfaceValidationError):
            Http.to_python(dict(
                url='http://example.com',
                method='A',
            ))

        result = Http.to_python(dict(
            url='http://example.com',
            method='TEST',
        ))
        assert result.method == 'TEST'

        result = Http.to_python(dict(
            url='http://example.com',
            method='FOO-BAR',
        ))
        assert result.method == 'FOO-BAR'

        result = Http.to_python(dict(
            url='http://example.com',
            method='FOO_BAR',
        ))
        assert result.method == 'FOO_BAR'
