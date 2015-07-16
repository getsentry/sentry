from __future__ import absolute_import

from sentry.models import GroupStatus
from sentry.testutils import TestCase
from sentry.search.utils import parse_query


class ParseQueryTest(TestCase):
    def test_simple(self):
        result = parse_query('foo bar', self.user)
        assert result == {'tags': {}, 'query': 'foo bar'}

    def test_useless_prefix(self):
        result = parse_query('foo: bar', self.user)
        assert result == {'tags': {}, 'query': 'foo: bar'}

    def test_mix_tag_and_query(self):
        result = parse_query('foo bar key:value', self.user)
        assert result == {'tags': {'key': 'value'}, 'query': 'foo bar'}

    def test_single_tag(self):
        result = parse_query('key:value', self.user)
        assert result == {'tags': {'key': 'value'}, 'query': ''}

    def test_tag_with_colon_in_value(self):
        result = parse_query('url:http://example.com', self.user)
        assert result == {'tags': {'url': 'http://example.com'}, 'query': ''}

    def test_multiple_tags(self):
        result = parse_query('foo:bar key:value', self.user)
        assert result == {'tags': {'key': 'value', 'foo': 'bar'}, 'query': ''}

    def test_single_tag_with_quotes(self):
        result = parse_query('foo:"bar"', self.user)
        assert result == {'tags': {'foo': 'bar'}, 'query': ''}

    def test_tag_with_quotes_and_query(self):
        result = parse_query('key:"a value" hello', self.user)
        assert result == {'tags': {'key': 'a value'}, 'query': 'hello'}

    def test_is_resolved(self):
        result = parse_query('is:resolved', self.user)
        assert result == {'status': GroupStatus.RESOLVED, 'tags': {}, 'query': ''}

    def test_assigned_me(self):
        result = parse_query('assigned:me', self.user)
        assert result == {'assigned_to': self.user, 'tags': {}, 'query': ''}

    def test_assigned_email(self):
        result = parse_query('assigned:%s' % (self.user.email,), self.user)
        assert result == {'assigned_to': self.user, 'tags': {}, 'query': ''}

    def test_assigned_unknown_user(self):
        result = parse_query('assigned:fake@example.com', self.user)
        assert result['assigned_to'].id == 0

    def test_first_release(self):
        result = parse_query('first-release:bar', self.user)
        assert result == {'first_release': 'bar', 'tags': {}, 'query': ''}

    def test_release(self):
        result = parse_query('release:bar', self.user)
        assert result == {'tags': {'sentry:release': 'bar'}, 'query': ''}
