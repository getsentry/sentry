from __future__ import absolute_import

from datetime import timedelta

from django.utils import timezone
from exam import fixture

from sentry.api.serializers import serialize
from sentry.models.recentsearch import RecentSearch
from sentry.models.search_common import SearchType
from sentry.testutils import APITestCase


class RecentSearchesListTest(APITestCase):
    endpoint = 'sentry-api-0-organization-recent-searches'

    @fixture
    def user(self):
        return self.create_user('test@test.com')

    def check_results(self, expected, search_type):
        self.login_as(user=self.user)
        response = self.get_valid_response(self.organization.slug, type=search_type.value)
        assert response.data == serialize(expected)

    def test_simple(self):
        self.create_team(members=[self.user])
        RecentSearch.objects.create(
            organization=self.organization,
            user=self.create_user('other@user.com'),
            type=SearchType.ISSUE.value,
            query='some test',
        )
        RecentSearch.objects.create(
            organization=self.create_organization(),
            user=self.user,
            type=SearchType.ISSUE.value,
            query='some test',
        )
        event_recent_search = RecentSearch.objects.create(
            organization=self.organization,
            user=self.user,
            type=SearchType.EVENT.value,
            query='some test',
            last_seen=timezone.now().replace(microsecond=0),
            date_added=timezone.now().replace(microsecond=0),
        )
        issue_recent_searches = [
            RecentSearch.objects.create(
                organization=self.organization,
                user=self.user,
                type=SearchType.ISSUE.value,
                query='some test',
                last_seen=timezone.now().replace(microsecond=0),
                date_added=timezone.now().replace(microsecond=0),
            ),
            RecentSearch.objects.create(
                organization=self.organization,
                user=self.user,
                type=SearchType.ISSUE.value,
                query='older query',
                last_seen=timezone.now().replace(microsecond=0) - timedelta(minutes=30),
                date_added=timezone.now().replace(microsecond=0) - timedelta(minutes=30),
            ),
            RecentSearch.objects.create(
                organization=self.organization,
                user=self.user,
                type=SearchType.ISSUE.value,
                query='oldest query',
                last_seen=timezone.now().replace(microsecond=0) - timedelta(hours=1),
                date_added=timezone.now().replace(microsecond=0) - timedelta(hours=1),
            ),
        ]
        self.check_results(issue_recent_searches, search_type=SearchType.ISSUE)
        self.check_results([event_recent_search], search_type=SearchType.EVENT)

    def test_param_validation(self):
        self.login_as(user=self.user)
        error_cases = [
            ({'type': 5}, 'Invalid input for `type`'),
            ({'type': 'hi'}, 'Invalid input for `type`'),
            ({'limit': 'hi'}, 'Invalid input for `limit`'),
        ]
        for query_kwargs, expected_error in error_cases:
            response = self.get_response(
                self.organization.slug,
                **query_kwargs
            )
            assert response.status_code == 400
            assert response.data['detail'].startswith(expected_error)
