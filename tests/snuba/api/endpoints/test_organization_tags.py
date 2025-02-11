import uuid
from unittest import mock

from django.urls import reverse
from rest_framework.exceptions import ErrorDetail

from sentry.replays.testutils import mock_replay
from sentry.testutils.cases import APITestCase, ReplaysSnubaTestCase, SnubaTestCase
from sentry.testutils.helpers.datetime import before_now
from sentry.utils.samples import load_data
from tests.sentry.issues.test_utils import OccurrenceTestMixin


class OrganizationTagsTest(APITestCase, OccurrenceTestMixin, SnubaTestCase):
    def setUp(self):
        super().setUp()
        self.min_ago = before_now(minutes=1).isoformat()

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

        url = reverse(
            "sentry-api-0-organization-tags", kwargs={"organization_id_or_slug": org.slug}
        )

        response = self.client.get(url, {"statsPeriod": "14d"}, format="json")
        assert response.status_code == 200, response.content
        data = response.data
        data.sort(key=lambda val: val["totalValues"], reverse=True)
        assert data == [
            {"name": "Level", "key": "level", "totalValues": 4},
            {"name": "Fruit", "key": "fruit", "totalValues": 3},
            {"name": "Some Tag", "key": "some_tag", "totalValues": 1},
        ]

    def test_simple_flags(self):
        user = self.create_user()
        org = self.create_organization()
        team = self.create_team(organization=org)
        self.create_member(organization=org, user=user, teams=[team])

        self.login_as(user=user)

        project = self.create_project(organization=org, teams=[team])
        self.store_event(
            data={
                "contexts": {
                    "flags": {
                        "values": [
                            {"flag": "abc", "result": True},
                            {"flag": "def", "result": False},
                        ]
                    }
                },
                "timestamp": before_now(minutes=1).isoformat(),
            },
            project_id=project.id,
        )
        self.store_event(
            data={
                "contexts": {
                    "flags": {
                        "values": [
                            {"flag": "abc", "result": False},
                        ]
                    }
                },
                "timestamp": before_now(minutes=1).isoformat(),
            },
            project_id=project.id,
        )

        url = reverse(
            "sentry-api-0-organization-tags", kwargs={"organization_id_or_slug": org.slug}
        )

        response = self.client.get(
            url,
            {"statsPeriod": "14d", "useFlagsBackend": "1", "dataset": "events"},
            format="json",
        )
        assert response.status_code == 200, response.content
        data = response.data
        data.sort(key=lambda val: val["totalValues"], reverse=True)
        assert data == [
            {"key": "abc", "name": "Abc", "totalValues": 2},
            {"key": "def", "name": "Def", "totalValues": 1},
        ]

    def test_dataset_events(self):
        user = self.create_user()
        org = self.create_organization()
        team = self.create_team(organization=org)
        self.create_member(organization=org, user=user, teams=[team])

        self.login_as(user=user)

        project = self.create_project(organization=org, teams=[team])
        self.store_event(
            data={"event_id": "a" * 32, "tags": {"berry": "raspberry"}, "timestamp": self.min_ago},
            project_id=project.id,
        )

        url = reverse(
            "sentry-api-0-organization-tags", kwargs={"organization_id_or_slug": org.slug}
        )

        response = self.client.get(url, {"statsPeriod": "14d", "dataset": "events"}, format="json")

        assert response.status_code == 200, response.content
        data = response.data
        data.sort(key=lambda val: val["name"])
        assert data == [
            {"name": "Berry", "key": "berry", "totalValues": 1},
            {"name": "Level", "key": "level", "totalValues": 1},
        ]

    def test_dataset_discover(self):
        user = self.create_user()
        org = self.create_organization()
        team = self.create_team(organization=org)
        self.create_member(organization=org, user=user, teams=[team])

        self.login_as(user=user)

        project = self.create_project(organization=org, teams=[team])

        url = reverse(
            "sentry-api-0-organization-tags", kwargs={"organization_id_or_slug": org.slug}
        )

        event = load_data("transaction")
        event["tags"].extend([["apple", "fuji"]])
        event.update(
            {
                "transaction": "example_transaction",
                "event_id": uuid.uuid4().hex,
                "start_timestamp": self.min_ago,
                "timestamp": self.min_ago,
            }
        )
        event["measurements"]["lcp"]["value"] = 5000
        self.store_event(data=event, project_id=project.id)

        discoverResponse = self.client.get(
            url,
            {"statsPeriod": "14d", "dataset": "discover"},
            format="json",
        )
        assert discoverResponse.status_code == 200, discoverResponse.content
        # Other tags are added by default, just check that the one we added exists
        assert {"name": "Apple", "key": "apple", "totalValues": 1} in discoverResponse.data

    def test_dataset_issue_platform(self):
        user = self.create_user()
        org = self.create_organization()
        team = self.create_team(organization=org)
        self.create_member(organization=org, user=user, teams=[team])

        self.login_as(user=user)

        project = self.create_project(organization=org, teams=[team])

        self.store_event(
            data={"event_id": "a" * 32, "tags": {"berry": "raspberry"}, "timestamp": self.min_ago},
            project_id=project.id,
        )

        self.process_occurrence(
            event_id=uuid.uuid4().hex,
            project_id=project.id,
            event_data={
                "title": "some problem",
                "platform": "python",
                "tags": {"stone_fruit": "cherry"},
                "timestamp": before_now(minutes=1).isoformat(),
                "received": before_now(minutes=1).isoformat(),
            },
        )

        url = reverse(
            "sentry-api-0-organization-tags", kwargs={"organization_id_or_slug": org.slug}
        )

        response = self.client.get(
            url, {"statsPeriod": "14d", "dataset": "search_issues"}, format="json"
        )

        assert response.status_code == 200, response.content
        data = response.data
        data.sort(key=lambda val: val["name"])
        assert data == [
            {"name": "Level", "key": "level", "totalValues": 1},
            {"name": "Stone Fruit", "key": "stone_fruit", "totalValues": 1},
        ]

    def test_dataset_combination(self):
        user = self.create_user()
        org = self.create_organization()
        team = self.create_team(organization=org)
        self.create_member(organization=org, user=user, teams=[team])
        self.login_as(user=user)
        project = self.create_project(organization=org, teams=[team])
        # Added to Events AND Discover Datasets
        self.store_event(
            data={"event_id": "a" * 32, "tags": {"berry": "raspberry"}, "timestamp": self.min_ago},
            project_id=project.id,
        )
        # Added to Discover Dataset
        discoverEvent = load_data("transaction")
        discoverEvent["tags"].extend([["apple", "fuji"]])
        discoverEvent.update(
            {
                "transaction": "example_transaction",
                "event_id": uuid.uuid4().hex,
                "start_timestamp": self.min_ago,
                "timestamp": self.min_ago,
            }
        )
        discoverEvent["measurements"]["lcp"]["value"] = 5000
        self.store_event(data=discoverEvent, project_id=project.id)
        # Added to IssuePlatform Dataset
        self.process_occurrence(
            event_id=uuid.uuid4().hex,
            project_id=project.id,
            event_data={
                "title": "some problem",
                "platform": "python",
                "tags": {"stone_fruit": "cherry"},
                "timestamp": before_now(minutes=1).isoformat(),
                "received": before_now(minutes=1).isoformat(),
            },
        )

        url = reverse(
            "sentry-api-0-organization-tags", kwargs={"organization_id_or_slug": org.slug}
        )

        eventsResponse = self.client.get(
            url, {"statsPeriod": "14d", "dataset": "events"}, format="json"
        )

        assert eventsResponse.status_code == 200, eventsResponse.content
        eventsData = eventsResponse.data
        eventsData.sort(key=lambda val: val["name"])
        assert eventsData == [
            {"name": "Berry", "key": "berry", "totalValues": 1},
            {"name": "Level", "key": "level", "totalValues": 1},
        ]

        discoverResponse = self.client.get(
            url, {"statsPeriod": "14d", "dataset": "discover"}, format="json"
        )
        discoverData = discoverResponse.data
        assert {"name": "Berry", "key": "berry", "totalValues": 1} in discoverData
        assert {"name": "Apple", "key": "apple", "totalValues": 1} in discoverData

        issuePlatformResponse = self.client.get(
            url, {"statsPeriod": "14d", "dataset": "search_issues"}, format="json"
        )
        issuePlatformData = issuePlatformResponse.data
        issuePlatformData.sort(key=lambda val: val["name"])
        assert issuePlatformData == [
            {"name": "Level", "key": "level", "totalValues": 1},
            {"name": "Stone Fruit", "key": "stone_fruit", "totalValues": 1},
        ]

    def test_invalid_dataset(self):
        user = self.create_user()
        org = self.create_organization()
        team = self.create_team(organization=org)
        self.create_member(organization=org, user=user, teams=[team])
        self.login_as(user=user)
        project = self.create_project(organization=org, teams=[team])

        self.store_event(
            data={"event_id": "a" * 32, "tags": {"berry": "raspberry"}, "timestamp": self.min_ago},
            project_id=project.id,
        )

        url = reverse(
            "sentry-api-0-organization-tags", kwargs={"organization_id_or_slug": org.slug}
        )

        response = self.client.get(
            url, {"statsPeriod": "14d", "dataset": "invalid_dataset"}, format="json"
        )
        assert response.status_code == 400
        assert response.data == {
            "detail": ErrorDetail(string="Invalid dataset parameter", code="parse_error")
        }

    def test_no_projects(self):
        user = self.create_user()
        org = self.create_organization(owner=user)
        self.login_as(user=user)

        url = reverse(
            "sentry-api-0-organization-tags", kwargs={"organization_id_or_slug": org.slug}
        )

        response = self.client.get(url, format="json")
        assert response.status_code == 200, response.content
        assert response.data == []

    @mock.patch("sentry.utils.snuba.query", return_value={})
    def test_tag_caching(self, mock_snuba_query):
        user = self.create_user()
        org = self.create_organization()
        team = self.create_team(organization=org)
        self.create_member(organization=org, user=user, teams=[team])
        self.create_project(organization=org, teams=[team])
        self.login_as(user=user)

        with self.options({"snuba.tagstore.cache-tagkeys-rate": 1.0}):
            url = reverse(
                "sentry-api-0-organization-tags", kwargs={"organization_id_or_slug": org.slug}
            )
            response = self.client.get(url, {"use_cache": "1", "statsPeriod": "14d"}, format="json")
            assert response.status_code == 200, response.content
            assert mock_snuba_query.call_count == 1

            response = self.client.get(url, {"use_cache": "1", "statsPeriod": "14d"}, format="json")
            assert response.status_code == 200, response.content
            # Cause we're caching, we shouldn't call snuba again
            assert mock_snuba_query.call_count == 1

    @mock.patch("sentry.utils.snuba.query", return_value={})
    def test_different_statsperiod_caching(self, mock_snuba_query):
        user = self.create_user()
        org = self.create_organization()
        team = self.create_team(organization=org)
        self.create_member(organization=org, user=user, teams=[team])
        self.create_project(organization=org, teams=[team])
        self.login_as(user=user)

        with self.options({"snuba.tagstore.cache-tagkeys-rate": 1.0}):
            url = reverse(
                "sentry-api-0-organization-tags", kwargs={"organization_id_or_slug": org.slug}
            )
            response = self.client.get(url, {"use_cache": "1", "statsPeriod": "14d"}, format="json")
            assert response.status_code == 200, response.content
            # Empty cache, we should query snuba
            assert mock_snuba_query.call_count == 1

            response = self.client.get(url, {"use_cache": "1", "statsPeriod": "30d"}, format="json")
            assert response.status_code == 200, response.content
            # With a different statsPeriod, we shouldn't use cache and still query snuba
            assert mock_snuba_query.call_count == 2

    @mock.patch("sentry.utils.snuba.query", return_value={})
    def test_different_times_caching(self, mock_snuba_query):
        user = self.create_user()
        org = self.create_organization()
        team = self.create_team(organization=org)
        self.create_member(organization=org, user=user, teams=[team])
        self.create_project(organization=org, teams=[team])
        self.login_as(user=user)

        with self.options({"snuba.tagstore.cache-tagkeys-rate": 1.0}):
            start = before_now(minutes=10).isoformat()
            end = before_now(minutes=5).isoformat()
            url = reverse(
                "sentry-api-0-organization-tags", kwargs={"organization_id_or_slug": org.slug}
            )
            response = self.client.get(
                url, {"use_cache": "1", "start": start, "end": end}, format="json"
            )
            assert response.status_code == 200, response.content
            assert mock_snuba_query.call_count == 1

            # 5 minutes later, cache_key should be different
            start = before_now(minutes=5).isoformat()
            end = before_now(minutes=0).isoformat()
            response = self.client.get(
                url, {"use_cache": "1", "start": start, "end": end}, format="json"
            )
            assert response.status_code == 200, response.content
            assert mock_snuba_query.call_count == 2

    def test_different_times_retrieves_cache(self):
        user = self.create_user()
        org = self.create_organization()
        team = self.create_team(organization=org)
        self.create_member(organization=org, user=user, teams=[team])
        project = self.create_project(organization=org, teams=[team])

        with self.options({"snuba.tagstore.cache-tagkeys-rate": 1.0}):
            start = before_now(minutes=10).isoformat()
            middle = before_now(minutes=5).isoformat()
            end = before_now(minutes=0).isoformat()
            # Throw an event in the middle of the time window, since end might get rounded down a bit
            self.store_event(
                data={"event_id": "a" * 32, "tags": {"fruit": "apple"}, "timestamp": middle},
                project_id=project.id,
            )
            self.login_as(user=user)

            url = reverse(
                "sentry-api-0-organization-tags", kwargs={"organization_id_or_slug": org.slug}
            )
            response = self.client.get(
                url, {"use_cache": "1", "start": start, "end": end}, format="json"
            )
            original_data = response.data

            url = reverse(
                "sentry-api-0-organization-tags", kwargs={"organization_id_or_slug": org.slug}
            )
            response = self.client.get(
                url, {"use_cache": "1", "start": start, "end": end}, format="json"
            )
            cached_data = response.data

            assert original_data == cached_data


class ReplayOrganizationTagsTest(APITestCase, ReplaysSnubaTestCase):
    def test_dataset_replays(self):
        self.login_as(user=self.user)
        replay1_id = uuid.uuid4().hex
        replay2_id = uuid.uuid4().hex
        replay3_id = uuid.uuid4().hex
        self.r1_seq0_timestamp = before_now(seconds=22)
        self.r1_seq1_timestamp = before_now(seconds=15)
        self.r2_seq0_timestamp = before_now(seconds=10)
        self.r3_seq0_timestamp = before_now(seconds=10)
        self.store_replays(
            mock_replay(
                self.r1_seq0_timestamp,
                self.project.id,
                replay1_id,
                tags={"fruit": "orange"},
                segment_id=0,
            ),
        )
        self.store_replays(
            mock_replay(
                self.r1_seq1_timestamp,
                self.project.id,
                replay1_id,
                tags={"fruit": "orange"},
                segment_id=1,
            ),
        )

        self.store_replays(
            mock_replay(
                self.r2_seq0_timestamp,
                self.project.id,
                replay2_id,
                tags={"fruit": "orange"},
            )
        )
        self.store_replays(
            mock_replay(
                self.r3_seq0_timestamp,
                self.project.id,
                replay3_id,
                tags={"fruit": "apple", "drink": "water"},
            )
        )

        url = reverse(
            "sentry-api-0-organization-tags",
            kwargs={"organization_id_or_slug": self.organization.slug},
        )
        response = self.client.get(url, {"statsPeriod": "14d", "dataset": "replays"}, format="json")

        assert response.status_code == 200, response.content
        data = response.data
        data.sort(key=lambda val: val["name"])
        assert data == [
            {"key": "drink", "name": "Drink", "totalValues": 1},
            {"key": "fruit", "name": "Fruit", "totalValues": 4},
        ]
