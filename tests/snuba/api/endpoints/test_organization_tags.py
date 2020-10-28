from __future__ import absolute_import

import mock

from django.core.urlresolvers import reverse

from sentry.testutils import APITestCase, SnubaTestCase
from sentry.testutils.helpers.datetime import before_now, iso_format


class OrganizationTagsTest(APITestCase, SnubaTestCase):
    def setUp(self):
        super(OrganizationTagsTest, self).setUp()
        self.min_ago = iso_format(before_now(minutes=1))

    def test_simple(self):
        user = self.create_user()
        org = self.create_organization()
        team = self.create_team(organization=org)
        self.create_member(organization=org, user=user, teams=[team])

        self.login_as(user=user)

        project = self.create_project(organization=org, teams=[team])
        self.store_event(
            data={"event_id": "a" * 32, "tags": {"fruit": "apple"}, "timestamp": self.min_ago},
            project_id=project.id,
        )
        self.store_event(
            data={"event_id": "b" * 32, "tags": {"fruit": "orange"}, "timestamp": self.min_ago},
            project_id=project.id,
        )
        self.store_event(
            data={
                "event_id": "c" * 32,
                "tags": {"some_tag": "some_value"},
                "timestamp": self.min_ago,
            },
            project_id=project.id,
        )
        self.store_event(
            data={"event_id": "d" * 32, "tags": {"fruit": "orange"}, "timestamp": self.min_ago},
            project_id=project.id,
        )

        url = reverse("sentry-api-0-organization-tags", kwargs={"organization_slug": org.slug})

        response = self.client.get(url, format="json")
        assert response.status_code == 200, response.content
        data = response.data
        data.sort(key=lambda val: val["totalValues"], reverse=True)
        assert data == [
            {"name": "Level", "key": "level", "totalValues": 4},
            {"name": "Fruit", "key": "fruit", "totalValues": 3},
            {"name": "Some Tag", "key": "some_tag", "totalValues": 1},
        ]

    def test_no_projects(self):
        user = self.create_user()
        org = self.create_organization(owner=user)
        self.login_as(user=user)

        url = reverse("sentry-api-0-organization-tags", kwargs={"organization_slug": org.slug})

        response = self.client.get(url, format="json")
        assert response.status_code == 200, response.content
        assert response.data == []

    @mock.patch("sentry.options.get", return_value=1.0)
    @mock.patch("sentry.utils.snuba.query", return_value={})
    def test_tag_caching(self, mock_snuba_query, mock_options):
        user = self.create_user()
        org = self.create_organization()
        team = self.create_team(organization=org)
        self.create_member(organization=org, user=user, teams=[team])
        self.create_project(organization=org, teams=[team])
        self.login_as(user=user)

        url = reverse("sentry-api-0-organization-tags", kwargs={"organization_slug": org.slug})
        response = self.client.get(url, {"use_cache": "1", "statsPeriod": "14d"}, format="json")
        assert response.status_code == 200, response.content
        assert mock_snuba_query.call_count == 1

        response = self.client.get(url, {"use_cache": "1", "statsPeriod": "14d"}, format="json")
        assert response.status_code == 200, response.content
        # Cause we're caching, we shouldn't call snuba again
        assert mock_snuba_query.call_count == 1

    @mock.patch("sentry.options.get", return_value=1.0)
    @mock.patch("sentry.utils.snuba.query", return_value={})
    def test_different_statsperiod_caching(self, mock_snuba_query, mock_options):
        user = self.create_user()
        org = self.create_organization()
        team = self.create_team(organization=org)
        self.create_member(organization=org, user=user, teams=[team])
        self.create_project(organization=org, teams=[team])
        self.login_as(user=user)

        url = reverse("sentry-api-0-organization-tags", kwargs={"organization_slug": org.slug})
        response = self.client.get(url, {"use_cache": "1", "statsPeriod": "14d"}, format="json")
        assert response.status_code == 200, response.content
        # Empty cache, we should query snuba
        assert mock_snuba_query.call_count == 1

        response = self.client.get(url, {"use_cache": "1", "statsPeriod": "30d"}, format="json")
        assert response.status_code == 200, response.content
        # With a different statsPeriod, we shouldn't use cache and still query snuba
        assert mock_snuba_query.call_count == 2

    @mock.patch("sentry.options.get", return_value=1.0)
    @mock.patch("sentry.utils.snuba.query", return_value={})
    def test_different_times_caching(self, mock_snuba_query, mock_options):
        user = self.create_user()
        org = self.create_organization()
        team = self.create_team(organization=org)
        self.create_member(organization=org, user=user, teams=[team])
        self.create_project(organization=org, teams=[team])
        self.login_as(user=user)

        start = iso_format(before_now(minutes=10))
        end = iso_format(before_now(minutes=5))
        url = reverse("sentry-api-0-organization-tags", kwargs={"organization_slug": org.slug})
        response = self.client.get(
            url, {"use_cache": "1", "start": start, "end": end}, format="json"
        )
        assert response.status_code == 200, response.content
        assert mock_snuba_query.call_count == 1

        # 5 minutes later, cache_key should be different
        start = iso_format(before_now(minutes=5))
        end = iso_format(before_now(minutes=0))
        response = self.client.get(
            url, {"use_cache": "1", "start": start, "end": end}, format="json"
        )
        assert response.status_code == 200, response.content
        assert mock_snuba_query.call_count == 2

    @mock.patch("sentry.options.get", return_value=1.0)
    def test_different_times_retrieves_cache(self, mock_options):
        user = self.create_user()
        org = self.create_organization()
        team = self.create_team(organization=org)
        self.create_member(organization=org, user=user, teams=[team])
        project = self.create_project(organization=org, teams=[team])

        start = iso_format(before_now(minutes=10))
        middle = iso_format(before_now(minutes=5))
        end = iso_format(before_now(minutes=0))
        # Throw an event in the middle of the time window, since end might get rounded down a bit
        self.store_event(
            data={"event_id": "a" * 32, "tags": {"fruit": "apple"}, "timestamp": middle},
            project_id=project.id,
        )
        self.login_as(user=user)

        url = reverse("sentry-api-0-organization-tags", kwargs={"organization_slug": org.slug})
        response = self.client.get(
            url, {"use_cache": "1", "start": start, "end": end}, format="json"
        )
        original_data = response.data

        url = reverse("sentry-api-0-organization-tags", kwargs={"organization_slug": org.slug})
        response = self.client.get(
            url, {"use_cache": "1", "start": start, "end": end}, format="json"
        )
        cached_data = response.data

        assert original_data == cached_data
