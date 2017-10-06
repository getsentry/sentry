from __future__ import absolute_import

import pytest
import mock
from datetime import datetime, timedelta
from django.utils import timezone

from sentry.models import EventUser, GroupStatus, Release
from sentry.testutils import TestCase
from sentry.search.base import ANY
from sentry.search.utils import parse_query, get_numeric_field_value


def test_get_numeric_field_value():
    assert get_numeric_field_value('foo', '10') == {
        'foo': 10,
    }

    assert get_numeric_field_value('foo', '>10') == {
        'foo_lower': 10,
        'foo_lower_inclusive': False,
    }

    assert get_numeric_field_value('foo', '>=10') == {
        'foo_lower': 10,
        'foo_lower_inclusive': True,
    }

    assert get_numeric_field_value('foo', '<10') == {
        'foo_upper': 10,
        'foo_upper_inclusive': False,
    }

    assert get_numeric_field_value('foo', '<=10') == {
        'foo_upper': 10,
        'foo_upper_inclusive': True,
    }

    assert get_numeric_field_value(
        'foo', '>3.5', type=float
    ) == {
        'foo_lower': 3.5,
        'foo_lower_inclusive': False,
    }

    assert get_numeric_field_value(
        'foo', '<=-3.5', type=float
    ) == {
        'foo_upper': -3.5,
        'foo_upper_inclusive': True,
    }


class ParseQueryTest(TestCase):
    def parse_query(self, query):
        return parse_query(self.project, query, self.user)

    def test_simple(self):
        result = self.parse_query('foo bar')
        assert result == {'tags': {}, 'query': 'foo bar'}

    def test_useless_prefix(self):
        result = self.parse_query('foo: bar')
        assert result == {'tags': {}, 'query': 'foo: bar'}

    def test_useless_prefix_with_symbol(self):
        result = self.parse_query('foo:  @ba$r')
        assert result == {'tags': {}, 'query': 'foo:  @ba$r'}

    def test_useless_prefix_with_colon(self):
        result = self.parse_query('foo:  :ba:r::foo:')
        assert result == {'tags': {}, 'query': 'foo:  :ba:r::foo:'}

    def test_handles_space_seperation_after_useless_prefix_exception(self):
        result = self.parse_query('foo: bar foo:bar')
        assert result == {'tags': {'foo': 'bar'}, 'query': 'foo: bar'}

    def test_handles_period_in_tag_key(self):
        result = self.parse_query('foo.bar:foobar')
        assert result == {'tags': {'foo.bar': 'foobar'}, 'query': ''}

    def test_handles_dash_in_tag_key(self):
        result = self.parse_query('foo-bar:foobar')
        assert result == {'tags': {'foo-bar': 'foobar'}, 'query': ''}

    # TODO: update docs to include minutes, days, and weeks suffixes
    @mock.patch('django.utils.timezone.now')
    def test_age_tag_negative_value(self, now):
        start = datetime(2016, 1, 1, tzinfo=timezone.utc)
        now.return_value = start
        expected = start - timedelta(hours=12)
        result = self.parse_query('age:-12h')
        assert result == {'tags': {}, 'query': '', 'age_from': expected, 'age_from_inclusive': True}

    @mock.patch('django.utils.timezone.now')
    def test_age_tag_positive_value(self, now):
        start = datetime(2016, 1, 1, tzinfo=timezone.utc)
        now.return_value = start
        expected = start - timedelta(hours=12)
        result = self.parse_query('age:+12h')
        assert result == {'tags': {}, 'query': '', 'age_to': expected, 'age_to_inclusive': False}

    @mock.patch('django.utils.timezone.now')
    def test_age_tag_weeks(self, now):
        start = datetime(2016, 1, 1, tzinfo=timezone.utc)
        now.return_value = start
        expected = start - timedelta(days=35)
        result = self.parse_query('age:+5w')
        assert result == {'tags': {}, 'query': '', 'age_to': expected, 'age_to_inclusive': False}

    @mock.patch('django.utils.timezone.now')
    def test_age_tag_days(self, now):
        start = datetime(2016, 1, 1, tzinfo=timezone.utc)
        now.return_value = start
        expected = start - timedelta(days=10)
        result = self.parse_query('age:+10d')
        assert result == {'tags': {}, 'query': '', 'age_to': expected, 'age_to_inclusive': False}

    @mock.patch('django.utils.timezone.now')
    def test_age_tag_hours(self, now):
        start = datetime(2016, 1, 1, tzinfo=timezone.utc)
        now.return_value = start
        expected = start - timedelta(hours=10)
        result = self.parse_query('age:+10h')
        assert result == {'tags': {}, 'query': '', 'age_to': expected, 'age_to_inclusive': False}

    @mock.patch('django.utils.timezone.now')
    def test_age_tag_minutes(self, now):
        start = datetime(2016, 1, 1, tzinfo=timezone.utc)
        now.return_value = start
        expected = start - timedelta(minutes=30)
        result = self.parse_query('age:+30m')
        assert result == {'tags': {}, 'query': '', 'age_to': expected, 'age_to_inclusive': False}

    @mock.patch('django.utils.timezone.now')
    def test_two_age_tags(self, now):
        start = datetime(2016, 1, 1, tzinfo=timezone.utc)
        now.return_value = start
        expected_to = start - timedelta(hours=12)
        expected_from = start - timedelta(hours=24)
        result = self.parse_query('age:+12h age:-24h')
        assert result == {
            'tags': {},
            'query': '',
            'age_to': expected_to,
            'age_from': expected_from,
            'age_to_inclusive': False,
            'age_from_inclusive': True
        }

    def test_event_timestamp_syntax(self):
        result = self.parse_query('event.timestamp:2016-01-02')
        assert result == {
            'query': '',
            'date_from': datetime(2016, 1, 2, tzinfo=timezone.utc),
            'date_from_inclusive': True,
            'date_to': datetime(2016, 1, 3, tzinfo=timezone.utc),
            'date_to_inclusive': False,
            'tags': {}
        }

    def test_times_seen_syntax(self):
        result = self.parse_query('timesSeen:10')
        assert result == {'tags': {}, 'times_seen': 10, 'query': ''}

    # TODO: query parser for '>' timestamp should set inclusive to False.
    @pytest.mark.xfail
    def test_greater_than_comparator(self):
        result = self.parse_query('timesSeen:>10 event.timestamp:>2016-01-02')
        assert result == {
            'tags': {},
            'query': '',
            'times_seen_lower': 10,
            'times_seen_lower_inclusive': False,
            'date_from': datetime(2016, 1, 2, tzinfo=timezone.utc),
            'date_from_inclusive': False
        }

    def test_greater_than_equal_comparator(self):
        result = self.parse_query('timesSeen:>=10 event.timestamp:>=2016-01-02')
        assert result == {
            'tags': {},
            'query': '',
            'times_seen_lower': 10,
            'times_seen_lower_inclusive': True,
            'date_from': datetime(2016, 1, 2, tzinfo=timezone.utc),
            'date_from_inclusive': True
        }

    def test_less_than_comparator(self):
        result = self.parse_query('event.timestamp:<2016-01-02 timesSeen:<10')
        assert result == {
            'tags': {},
            'query': '',
            'times_seen_upper': 10,
            'times_seen_upper_inclusive': False,
            'date_to': datetime(2016, 1, 2, tzinfo=timezone.utc),
            'date_to_inclusive': False
        }

    # TODO: query parser for '<=' timestamp should set inclusive to True.
    @pytest.mark.xfail
    def test_less_than_equal_comparator(self):
        result = self.parse_query('event.timestamp:<=2016-01-02 timesSeen:<=10')
        assert result == {
            'tags': {},
            'query': '',
            'times_seen_upper': 10,
            'times_seen_upper_inclusive': True,
            'date_to': datetime(2016, 1, 2, tzinfo=timezone.utc),
            'date_to_inclusive': True
        }

    def test_handles_underscore_in_tag_key(self):
        result = self.parse_query('foo_bar:foobar')
        assert result == {'tags': {'foo_bar': 'foobar'}, 'query': ''}

    def test_mix_tag_and_query(self):
        result = self.parse_query('foo bar key:value')
        assert result == {'tags': {'key': 'value'}, 'query': 'foo bar'}

    def test_single_tag(self):
        result = self.parse_query('key:value')
        assert result == {'tags': {'key': 'value'}, 'query': ''}

    def test_tag_with_colon_in_value(self):
        result = self.parse_query('url:http://example.com')
        assert result == {'tags': {'url': 'http://example.com'}, 'query': ''}

    def test_single_space_in_value(self):
        result = self.parse_query('key:"value1 value2"')
        assert result == {'tags': {'key': 'value1 value2'}, 'query': ''}

    def test_multiple_spaces_in_value(self):
        result = self.parse_query('key:"value1  value2"')
        assert result == {'tags': {'key': 'value1  value2'}, 'query': ''}

    def test_invalid_tag_as_query(self):
        result = self.parse_query('Resque::DirtyExit')
        assert result == {'tags': {}, 'query': 'Resque::DirtyExit'}

    def test_colons_in_tag_value(self):
        result = self.parse_query('key:Resque::DirtyExit')
        assert result == {'tags': {'key': 'Resque::DirtyExit'}, 'query': ''}

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
        result = self.parse_query('assigned:%s' % (self.user.email, ))
        assert result == {'assigned_to': self.user, 'tags': {}, 'query': ''}

    def test_assigned_unknown_user(self):
        result = self.parse_query('assigned:fake@example.com')
        assert result['assigned_to'].id == 0

    def test_bookmarks_me(self):
        result = self.parse_query('bookmarks:me')
        assert result == {'bookmarked_by': self.user, 'tags': {}, 'query': ''}

    def test_bookmarks_email(self):
        result = self.parse_query('bookmarks:%s' % (self.user.email, ))
        assert result == {'bookmarked_by': self.user, 'tags': {}, 'query': ''}

    def test_bookmarks_unknown_user(self):
        result = self.parse_query('bookmarks:fake@example.com')
        assert result['bookmarked_by'].id == 0

    def test_first_release(self):
        result = self.parse_query('first-release:bar')
        assert result == {'first_release': 'bar', 'tags': {}, 'query': ''}

    def test_first_release_latest(self):
        old = Release.objects.create(organization_id=self.project.organization_id, version='a')
        old.add_project(self.project)
        new = Release.objects.create(
            version='b',
            organization_id=self.project.organization_id,
            date_released=old.date_added + timedelta(minutes=1),
        )
        new.add_project(self.project)

        result = self.parse_query('first-release:latest')
        assert result == {'tags': {}, 'first_release': new.version, 'query': ''}

    def test_release(self):
        result = self.parse_query('release:bar')
        assert result == {'tags': {'sentry:release': 'bar'}, 'query': ''}

    def test_dist(self):
        result = self.parse_query('dist:123')
        assert result == {'tags': {'sentry:dist': '123'}, 'query': ''}

    def test_release_latest(self):
        old = Release.objects.create(organization_id=self.project.organization_id, version='a')
        old.add_project(self.project)
        new = Release.objects.create(
            version='b',
            organization_id=self.project.organization_id,
            date_released=old.date_added + timedelta(minutes=1),
        )
        new.add_project(self.project)

        result = self.parse_query('release:latest')
        assert result == {'tags': {'sentry:release': new.version}, 'query': ''}

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
            project_id=self.project.id,
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
            project_id=self.project.id,
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

    def test_age_from(self):
        result = self.parse_query('age:-24h')
        assert result['age_from'] > timezone.now() - timedelta(hours=25)
        assert result['age_from'] < timezone.now() - timedelta(hours=23)
        assert not result.get('age_to')

    def test_age_to(self):
        result = self.parse_query('age:+24h')
        assert result['age_to'] > timezone.now() - timedelta(hours=25)
        assert result['age_to'] < timezone.now() - timedelta(hours=23)
        assert not result.get('age_from')

    def test_age_range(self):
        result = self.parse_query('age:-24h age:+12h')
        assert result['age_from'] > timezone.now() - timedelta(hours=25)
        assert result['age_from'] < timezone.now() - timedelta(hours=23)
        assert result['age_to'] > timezone.now() - timedelta(hours=13)
        assert result['age_to'] < timezone.now() - timedelta(hours=11)

    def test_first_seen_range(self):
        result = self.parse_query('firstSeen:-24h firstSeen:+12h')
        assert result['age_from'] > timezone.now() - timedelta(hours=25)
        assert result['age_from'] < timezone.now() - timedelta(hours=23)
        assert result['age_to'] > timezone.now() - timedelta(hours=13)
        assert result['age_to'] < timezone.now() - timedelta(hours=11)

    def test_date_range(self):
        result = self.parse_query('event.timestamp:>2016-01-01 event.timestamp:<2016-01-02')
        assert result['date_from'] == datetime(2016, 1, 1, tzinfo=timezone.utc)
        assert result['date_from_inclusive']
        assert result['date_to'] == datetime(2016, 1, 2, tzinfo=timezone.utc)
        assert not result['date_to_inclusive']

    def test_date_approx_day(self):
        date_value = datetime(2016, 1, 1, tzinfo=timezone.utc)
        result = self.parse_query('event.timestamp:2016-01-01')
        assert result['date_from'] == date_value
        assert result['date_from_inclusive']
        assert result['date_to'] == date_value + timedelta(days=1)
        assert not result['date_to_inclusive']

    def test_date_approx_precise(self):
        date_value = datetime(2016, 1, 1, tzinfo=timezone.utc)
        result = self.parse_query('event.timestamp:2016-01-01T00:00:00')
        assert result['date_from'] == date_value - timedelta(minutes=5)
        assert result['date_from_inclusive']
        assert result['date_to'] == date_value + timedelta(minutes=6)
        assert not result['date_to_inclusive']

    def test_active_range(self):
        result = self.parse_query('activeSince:-24h activeSince:+12h')
        assert result['active_at_from'] > timezone.now() - timedelta(hours=25)
        assert result['active_at_from'] < timezone.now() - timedelta(hours=23)
        assert result['active_at_to'] > timezone.now() - timedelta(hours=13)
        assert result['active_at_to'] < timezone.now() - timedelta(hours=11)

    def test_last_seen_range(self):
        result = self.parse_query('lastSeen:-24h lastSeen:+12h')
        assert result['last_seen_from'] > timezone.now() - timedelta(hours=25)
        assert result['last_seen_from'] < timezone.now() - timedelta(hours=23)
        assert result['last_seen_to'] > timezone.now() - timedelta(hours=13)
        assert result['last_seen_to'] < timezone.now() - timedelta(hours=11)

    def test_has_tag(self):
        result = self.parse_query('has:foo')
        assert result['tags']['foo'] == ANY

    def test_has_user(self):
        result = self.parse_query('has:user')
        assert result['tags']['sentry:user'] == ANY

    def test_has_release(self):
        result = self.parse_query('has:release')
        assert result['tags']['sentry:release'] == ANY

    def test_quoted_string(self):
        result = self.parse_query('"release:foo"')
        assert result == {'tags': {}, 'query': 'release:foo'}
