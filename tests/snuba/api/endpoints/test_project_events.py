from typing import int
from django.urls import reverse

from sentry.testutils.cases import APITestCase, SnubaTestCase
from sentry.testutils.helpers.datetime import before_now


class ProjectEventsTest(APITestCase, SnubaTestCase):
    def test_simple(self) -> None:
        self.login_as(user=self.user)

        project = self.create_project()
        event_1 = self.store_event(
            data={"timestamp": before_now(minutes=1).isoformat()}, project_id=project.id
        )
        event_2 = self.store_event(
            data={"timestamp": before_now(minutes=1).isoformat()}, project_id=project.id
        )

        url = reverse(
            "sentry-api-0-project-events",
            kwargs={
                "organization_id_or_slug": project.organization.slug,
                "project_id_or_slug": project.slug,
            },
        )
        response = self.client.get(url, format="json")

        assert response.status_code == 200, response.content
        assert len(response.data) == 2
        assert sorted(map(lambda x: x["eventID"], response.data)) == sorted(
            [event_1.event_id, event_2.event_id]
        )

    def test_message_search(self) -> None:
        self.login_as(user=self.user)

        project = self.create_project()
        self.store_event(
            data={"message": "how to make fast", "timestamp": before_now(minutes=1).isoformat()},
            project_id=project.id,
        )
        event_2 = self.store_event(
            data={"message": "Delet the Data", "timestamp": before_now(minutes=1).isoformat()},
            project_id=project.id,
        )

        url = reverse(
            "sentry-api-0-project-events",
            kwargs={
                "organization_id_or_slug": project.organization.slug,
                "project_id_or_slug": project.slug,
            },
        )
        response = self.client.get(url, {"query": "delet"}, format="json")

        assert response.status_code == 200, response.content
        assert len(response.data) == 1
        assert response.data[0]["eventID"] == event_2.event_id
        assert response.data[0]["message"] == "Delet the Data"

    def test_filters_based_on_retention(self) -> None:
        self.login_as(user=self.user)

        project = self.create_project()
        self.store_event(data={"timestamp": before_now(days=2).isoformat()}, project_id=project.id)
        event_2 = self.store_event(
            data={"timestamp": before_now(minutes=1).isoformat()}, project_id=project.id
        )

        with self.options({"system.event-retention-days": 1}):
            url = reverse(
                "sentry-api-0-project-events",
                kwargs={
                    "organization_id_or_slug": project.organization.slug,
                    "project_id_or_slug": project.slug,
                },
            )
            response = self.client.get(url, format="json")

        assert response.status_code == 200, response.content
        assert len(response.data) == 1
        assert response.data[0]["eventID"] == event_2.event_id

    def test_with_stats_period_parameter(self) -> None:
        self.login_as(user=self.user)

        project = self.create_project()

        # Event from 20 days ago
        self.store_event(data={"timestamp": before_now(days=20).isoformat()}, project_id=project.id)

        # Event from 2 days ago
        recent_event = self.store_event(
            data={"timestamp": before_now(days=2).isoformat()}, project_id=project.id
        )

        url = reverse(
            "sentry-api-0-project-events",
            kwargs={
                "organization_id_or_slug": project.organization.slug,
                "project_id_or_slug": project.slug,
            },
        )
        response = self.client.get(url, {"statsPeriod": "15d"}, format="json")

        assert response.status_code == 200, response.content

        # Only the recent event should be returned:
        assert len(response.data) == 1
        assert response.data[0]["eventID"] == recent_event.event_id

    def test_with_start_and_end_parameters(self) -> None:
        self.login_as(user=self.user)

        project = self.create_project()

        # Event from 10 days ago
        old_event = self.store_event(
            data={"timestamp": before_now(days=10).isoformat()}, project_id=project.id
        )

        # Event from 5 days ago
        intermediary_event = self.store_event(
            data={"timestamp": before_now(days=5).isoformat()}, project_id=project.id
        )

        # Event from 1 day ago
        self.store_event(data={"timestamp": before_now(days=1).isoformat()}, project_id=project.id)

        url = reverse(
            "sentry-api-0-project-events",
            kwargs={
                "organization_id_or_slug": project.organization.slug,
                "project_id_or_slug": project.slug,
            },
        )

        # Filter to get events from 12 days ago to 3 days ago
        start_time = before_now(days=12)
        end_time = before_now(days=3)

        response = self.client.get(
            url,
            {
                "start": start_time.isoformat(),
                "end": end_time.isoformat(),
            },
            format="json",
        )

        assert response.status_code == 200, response.content
        assert len(response.data) == 2
        event_ids = [event["eventID"] for event in response.data]
        assert old_event.event_id in event_ids
        assert intermediary_event.event_id in event_ids

    def test_with_timezone_naive_start_and_end_parameters(self) -> None:
        self.login_as(user=self.user)

        project = self.create_project()

        # Event from 10 days ago
        old_event = self.store_event(
            data={"timestamp": before_now(days=10).isoformat()}, project_id=project.id
        )

        # Event from 5 days ago
        intermediary_event = self.store_event(
            data={"timestamp": before_now(days=5).isoformat()}, project_id=project.id
        )

        # Event from 1 day ago
        self.store_event(data={"timestamp": before_now(days=1).isoformat()}, project_id=project.id)

        url = reverse(
            "sentry-api-0-project-events",
            kwargs={
                "organization_id_or_slug": project.organization.slug,
                "project_id_or_slug": project.slug,
            },
        )

        # Filter to get events from 12 days ago to 3 days ago
        start_time = before_now(days=12).replace(tzinfo=None)
        end_time = before_now(days=3).replace(tzinfo=None)

        response = self.client.get(
            url,
            {
                "start": start_time.isoformat(),
                "end": end_time.isoformat(),
            },
            format="json",
        )

        assert response.status_code == 200, response.content
        assert len(response.data) == 2
        event_ids = [event["eventID"] for event in response.data]
        assert old_event.event_id in event_ids
        assert intermediary_event.event_id in event_ids

    def test_with_invalid_stats_period_parameter(self) -> None:
        self.login_as(user=self.user)

        project = self.create_project()
        url = reverse(
            "sentry-api-0-project-events",
            kwargs={
                "organization_id_or_slug": project.organization.slug,
                "project_id_or_slug": project.slug,
            },
        )

        response = self.client.get(url, {"statsPeriod": "invalid"}, format="json")

        assert response.status_code == 400, response.content
        assert response.data["detail"] == "Invalid date range parameters provided"

    def test_with_invalid_start_parameter(self) -> None:
        self.login_as(user=self.user)

        project = self.create_project()
        url = reverse(
            "sentry-api-0-project-events",
            kwargs={
                "organization_id_or_slug": project.organization.slug,
                "project_id_or_slug": project.slug,
            },
        )
        end_time = before_now(days=3)
        response = self.client.get(
            url, {"start": "not-a-date", "end": end_time.isoformat()}, format="json"
        )

        assert response.status_code == 400, response.content
        assert response.data["detail"] == "Invalid date range parameters provided"

    def test_sample(self) -> None:
        self.login_as(user=self.user)

        project = self.create_project()
        event_1 = self.store_event(
            data={"timestamp": before_now(minutes=1).isoformat()}, project_id=project.id
        )
        event_2 = self.store_event(
            data={"timestamp": before_now(minutes=1).isoformat()}, project_id=project.id
        )

        url = reverse(
            "sentry-api-0-project-events",
            kwargs={
                "organization_id_or_slug": project.organization.slug,
                "project_id_or_slug": project.slug,
            },
        )
        response = self.client.get(url, {"sample": "true"}, format="json")

        assert response.status_code == 200, response.content
        assert len(response.data) == 2
        assert [event["eventID"] for event in response.data] == sorted(
            [event_1.event_id, event_2.event_id]
        )
