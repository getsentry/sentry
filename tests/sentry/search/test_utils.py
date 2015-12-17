from __future__ import absolute_import

from sentry.models import EventUser, GroupStatus
from sentry.testutils import TestCase
from sentry.search.utils import parse_query


class ParseQueryTest(TestCase):
    def parse_query(self, query):
        return parse_query(self.project, query, self.user)

    def test_simple(self):
        result = self.parse_query('foo bar')
        assert result == {'tags': {}, 'query': 'foo bar'}

    def test_useless_prefix(self):
        result = self.parse_query('foo: bar')
        assert result == {'tags': {}, 'query': 'foo: bar'}

    def test_mix_tag_and_query(self):
        result = self.parse_query('foo bar key:value')
        assert result == {'tags': {'key': 'value'}, 'query': 'foo bar'}

    def test_single_tag(self):
        result = self.parse_query('key:value')
        assert result == {'tags': {'key': 'value'}, 'query': ''}

    def test_tag_with_colon_in_value(self):
        result = self.parse_query('url:http://example.com')
        assert result == {'tags': {'url': 'http://example.com'}, 'query': ''}

    def test_multiple_tags(self):
        result = self.parse_query('foo:bar key:value')
        assert result == {'tags': {'key': 'value', 'foo': 'bar'}, 'query': ''}

    def test_single_tag_with_quotes(self):
        result = self.parse_query('foo:"bar"')
        assert result == {'tags': {'foo': 'bar'}, 'query': ''}

    def test_tag_with_quotes_and_query(self):
        result = self.parse_query('key:"a value" hello')
        assert result == {'tags': {'key': 'a value'}, 'query': 'hello'}

    def test_is_resolved(self):
        result = self.parse_query('is:resolved')
        assert result == {'status': GroupStatus.RESOLVED, 'tags': {}, 'query': ''}

    def test_assigned_me(self):
        result = self.parse_query('assigned:me')
        assert result == {'assigned_to': self.user, 'tags': {}, 'query': ''}

    def test_assigned_email(self):
        result = self.parse_query('assigned:%s' % (self.user.email,))
        assert result == {'assigned_to': self.user, 'tags': {}, 'query': ''}

    def test_assigned_unknown_user(self):
        result = self.parse_query('assigned:fake@example.com')
        assert result['assigned_to'].id == 0

    def test_first_release(self):
        result = self.parse_query('first-release:bar')
        assert result == {'first_release': 'bar', 'tags': {}, 'query': ''}

    def test_release(self):
        result = self.parse_query('release:bar')
        assert result == {'tags': {'sentry:release': 'bar'}, 'query': ''}

    def test_padded_spacing(self):
        result = self.parse_query('release:bar  foo   bar')
        assert result == {'tags': {'sentry:release': 'bar'}, 'query': 'foo bar'}

    def test_unknown_user_with_dot_query(self):
        result = self.parse_query('user.email:fake@example.com')
        assert result['tags']['sentry:user'] == 'email:fake@example.com'

    def test_unknown_user_value(self):
        result = self.parse_query('user.xxxxxx:example')
        assert result['tags']['sentry:user'] == 'xxxxxx:example'

    def test_user_lookup_with_dot_query(self):
        euser = EventUser.objects.create(
            project=self.project,
            ident='1',
            username='foobar',
        )
        result = self.parse_query('user.username:foobar')
        assert result['tags']['sentry:user'] == euser.tag_value

    def test_unknown_user_legacy_syntax(self):
        result = self.parse_query('user:email:fake@example.com')
        assert result['tags']['sentry:user'] == 'email:fake@example.com'

    def test_user_lookup_legacy_syntax(self):
        euser = EventUser.objects.create(
            project=self.project,
            ident='1',
            username='foobar',
        )
        result = self.parse_query('user:username:foobar')
        assert result['tags']['sentry:user'] == euser.tag_value

    def test_is_unassigned(self):
        result = self.parse_query('is:unassigned')
        assert result == {'unassigned': True, 'tags': {}, 'query': ''}

    def test_is_assigned(self):
        result = self.parse_query('is:assigned')
        assert result == {'unassigned': False, 'tags': {}, 'query': ''}
