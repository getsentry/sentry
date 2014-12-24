# -*- coding: utf-8 -*-

from __future__ import absolute_import

from exam import fixture

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
        assert result.cookies == {}
        assert result.headers == {}
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
        assert result.cookies == {'foo': 'bar'}
        assert result.headers == {'X-Foo-Bar': 'baz'}
        assert result.env == {'bing': 'bong'}
        assert result.data == 'hello world'

    def test_query_string_as_dict(self):
        result = Http.to_python(dict(
            url='http://example.com',
            query_string={'foo': 'bar'},
        ))
        assert result.query_string == 'foo=bar'

    def test_data_as_dict(self):
        result = Http.to_python(dict(
            url='http://example.com',
            data={'foo': 'bar'},
        ))
        assert result.data == {'foo': 'bar'}

    def test_data_as_list(self):
        result = Http.to_python(dict(
            url='http://example.com',
            data=['foo', 'bar'],
        ))
        assert result.data == {0: 'foo', 1: 'bar'}

    def test_form_encoded_data(self):
        result = Http.to_python(dict(
            url='http://example.com',
            headers={'Content-Type': 'application/x-www-form-urlencoded'},
            data='foo=bar',
        ))
        assert result.data == {'foo': 'bar'}

    def test_cookies_as_string(self):
        result = Http.to_python(dict(
            url='http://example.com',
            cookies='a=b;c=d',
        ))
        assert result.cookies == {'a': 'b', 'c': 'd'}
        result = Http.to_python(dict(
            url='http://example.com',
            cookies='a=b&c=d',
        ))
        assert result.cookies == {'a': 'b', 'c': 'd'}

    def test_cookies_in_header(self):
        result = Http.to_python(dict(
            url='http://example.com',
            headers={'Cookie': 'a=b;c=d'},
        ))
        assert result.cookies == {'a': 'b', 'c': 'd'}
        result = Http.to_python(dict(
            url='http://example.com',
            headers={'Cookie': 'a=b;c=d'},
            cookies={'foo': 'bar'},
        ))
        assert result.cookies == {'foo': 'bar'}

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

    def test_to_curl_get(self):
        result = Http.to_python(dict(
            method='GET',
            url='http://example.com',
            query_string='foo=bar',
            headers={'x-foo-bar': 'baz', 'accept-encoding': 'deflate, gzip'},
            cookies={'foo': 'bar'},
        ))
        assert result.to_curl() == "curl 'http://example.com?foo=bar' -H 'X-Foo-Bar: baz' -H 'Cookie: foo=bar' -H 'Accept-Encoding: deflate, gzip' --compressed"

    def test_to_curl_post(self):
        result = Http.to_python(dict(
            method='POST',
            url='http://example.com',
            query_string='foo=bar',
            headers={'x-foo-bar': 'baz', 'accept-encoding': 'deflate, gzip'},
            cookies={'foo': 'bar'},
            data='foo=bar&a=b',
        ))
        assert result.to_curl() == "curl -XPOST --data 'foo=bar&a=b' 'http://example.com?foo=bar' -H 'X-Foo-Bar: baz' -H 'Cookie: foo=bar' -H 'Accept-Encoding: deflate, gzip' --compressed"

    def test_to_curl_post_with_unicode(self):
        result = Http.to_python(dict(
            method='POST',
            url='http://example.com',
            data={u'föo': u'bär'},
        ))
        assert result.to_curl() == "curl -XPOST --data f%C3%B6o=b%C3%A4r http://example.com"
