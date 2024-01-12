from __future__ import annotations

from datetime import datetime, timedelta
from functools import cached_property
from typing import Any

from django.utils import timezone

from sentry.api.serializers import serialize
from sentry.models.recentsearch import RecentSearch
from sentry.models.search_common import SearchType
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.datetime import freeze_time
from sentry.testutils.silo import region_silo_test


@region_silo_test
class RecentSearchesListTest(APITestCase):
    endpoint = "sentry-api-0-organization-recent-searches"

    @cached_property
    def user(self):
        return self.create_user("test@test.com")

    def check_results(self, expected, search_type, query=None):
        self.login_as(user=self.user)
        kwargs = {}
        if query:
            kwargs["query"] = query
        response = self.get_success_response(
            self.organization.slug, type=search_type.value, **kwargs
        )
        assert response.data == serialize(expected)

    def test_simple(self):
        self.create_team(members=[self.user])
        RecentSearch.objects.create(
            organization=self.organization,
            user_id=self.create_user("other@user.com").id,
            type=SearchType.ISSUE.value,
            query="some test",
        )
        RecentSearch.objects.create(
            organization=self.create_organization(),
            user_id=self.user.id,
            type=SearchType.ISSUE.value,
            query="some test",
        )
        event_recent_search = RecentSearch.objects.create(
            organization=self.organization,
            user_id=self.user.id,
            type=SearchType.EVENT.value,
            query="some test",
            last_seen=timezone.now(),
            date_added=timezone.now(),
        )
        session_recent_search = RecentSearch.objects.create(
            organization=self.organization,
            user_id=self.user.id,
            type=SearchType.SESSION.value,
            query="some test",
            last_seen=timezone.now(),
            date_added=timezone.now(),
        )
        metric_recent_search = RecentSearch.objects.create(
            organization=self.organization,
            user_id=self.user.id,
            type=SearchType.METRIC.value,
            query="some test",
            last_seen=timezone.now(),
            date_added=timezone.now(),
        )
        issue_recent_searches = [
            RecentSearch.objects.create(
                organization=self.organization,
                user_id=self.user.id,
                type=SearchType.ISSUE.value,
                query="some test",
                last_seen=timezone.now(),
                date_added=timezone.now(),
            ),
            RecentSearch.objects.create(
                organization=self.organization,
                user_id=self.user.id,
                type=SearchType.ISSUE.value,
                query="older query",
                last_seen=timezone.now() - timedelta(minutes=30),
                date_added=timezone.now() - timedelta(minutes=30),
            ),
            RecentSearch.objects.create(
                organization=self.organization,
                user_id=self.user.id,
                type=SearchType.ISSUE.value,
                query="oldest query",
                last_seen=timezone.now() - timedelta(hours=1),
                date_added=timezone.now() - timedelta(hours=1),
            ),
        ]
        self.check_results(issue_recent_searches, search_type=SearchType.ISSUE)
        self.check_results([event_recent_search], search_type=SearchType.EVENT)
        self.check_results([session_recent_search], search_type=SearchType.SESSION)
        self.check_results([metric_recent_search], search_type=SearchType.METRIC)

    def test_param_validation(self):
        self.login_as(user=self.user)
        error_cases: list[tuple[dict[str, Any], str]] = [
            ({"type": 5}, "Invalid input for `type`"),
            ({"type": "hi"}, "Invalid input for `type`"),
            ({"limit": "hi"}, "Invalid input for `limit`"),
        ]
        for query_kwargs, expected_error in error_cases:
            response = self.get_response(self.organization.slug, **query_kwargs)
            assert response.status_code == 400
            assert response.data["detail"].startswith(expected_error)

    def test_query(self):
        issue_recent_searches = [
            RecentSearch.objects.create(
                organization=self.organization,
                user_id=self.user.id,
                type=SearchType.ISSUE.value,
                query="some test",
                last_seen=timezone.now(),
                date_added=timezone.now(),
            ),
            RecentSearch.objects.create(
                organization=self.organization,
                user_id=self.user.id,
                type=SearchType.ISSUE.value,
                query="older query",
                last_seen=timezone.now() - timedelta(minutes=30),
                date_added=timezone.now() - timedelta(minutes=30),
            ),
            RecentSearch.objects.create(
                organization=self.organization,
                user_id=self.user.id,
                type=SearchType.ISSUE.value,
                query="oldest query",
                last_seen=timezone.now() - timedelta(hours=1),
                date_added=timezone.now() - timedelta(hours=1),
            ),
        ]
        self.check_results(issue_recent_searches[1:], search_type=SearchType.ISSUE, query="lde")


class RecentSearchesCreateTest(APITestCase):
    endpoint = "sentry-api-0-organization-recent-searches"
    method = "post"

    @cached_property
    def organization(self):
        return self.create_organization()

    @cached_property
    def user(self):
        user = self.create_user("test@test.com")
        self.create_team(members=[user], organization=self.organization)
        return user

    def test(self):
        self.login_as(self.user)
        search_type = 1
        query = "something"
        the_date = datetime(2019, 1, 1, 1, 1, 1)
        with freeze_time(the_date):
            response = self.get_response(self.organization.slug, type=search_type, query=query)
            assert response.status_code == 201
            assert RecentSearch.objects.filter(
                organization=self.organization,
                user_id=self.user.id,
                type=search_type,
                query=query,
                last_seen=the_date,
            ).exists()
        the_date = datetime(2019, 1, 1, 2, 2, 2)
        with freeze_time(the_date):
            response = self.get_response(self.organization.slug, type=search_type, query=query)
            assert response.status_code == 204, response.content
            assert RecentSearch.objects.filter(
                organization=self.organization,
                user_id=self.user.id,
                type=search_type,
                query=query,
                last_seen=the_date,
            ).exists()
