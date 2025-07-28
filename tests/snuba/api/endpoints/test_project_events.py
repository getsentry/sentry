from django.urls import reverse

from sentry.testutils.cases import APITestCase, SnubaTestCase
from sentry.testutils.helpers.datetime import before_now


class ProjectEventsTest(APITestCase, SnubaTestCase):
    def test_simple(self):
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

    def test_message_search(self):
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

    def test_filters_based_on_retention(self):
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

    def test_limited_to_week(self):
        self.login_as(user=self.user)

        project = self.create_project()
        event = self.store_event(
            data={"timestamp": before_now(days=2).isoformat()}, project_id=project.id
        )
        self.store_event(data={"timestamp": before_now(days=8).isoformat()}, project_id=project.id)

        url = reverse(
            "sentry-api-0-project-events",
            kwargs={
                "organization_id_or_slug": project.organization.slug,
                "project_id_or_slug": project.slug,
            },
        )

        with self.feature("organizations:project-event-date-limit"):
            response = self.client.get(url, format="json")
            assert response.status_code == 200, response.content
            assert len(response.data) == 1
            assert response.data[0]["eventID"] == event.event_id

    def test_sample(self):
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

    def test_start_end_parameters(self):
        """Test filtering events with start and end parameters"""
        self.login_as(user=self.user)

        project = self.create_project()
        
        # Events outside range
        self.store_event(
            data={"timestamp": before_now(days=10).isoformat()}, project_id=project.id
        )
        self.store_event(
            data={"timestamp": before_now(hours=1).isoformat()}, project_id=project.id
        )
        
        # Events inside range
        event_in_range_1 = self.store_event(
            data={"timestamp": before_now(days=3).isoformat()}, project_id=project.id
        )
        event_in_range_2 = self.store_event(
            data={"timestamp": before_now(days=5).isoformat()}, project_id=project.id
        )

        url = reverse(
            "sentry-api-0-project-events",
            kwargs={
                "organization_id_or_slug": project.organization.slug,
                "project_id_or_slug": project.slug,
            },
        )
        
        start_time = before_now(days=6).isoformat()
        end_time = before_now(days=2).isoformat()
        
        response = self.client.get(url, {"start": start_time, "end": end_time}, format="json")

        assert response.status_code == 200, response.content
        assert len(response.data) == 2
        event_ids = {event["eventID"] for event in response.data}
        assert event_ids == {event_in_range_1.event_id, event_in_range_2.event_id}

    def test_stats_period_parameter(self):
        """Test filtering events with statsPeriod parameter"""
        self.login_as(user=self.user)

        project = self.create_project()
        
        # Event outside period
        self.store_event(
            data={"timestamp": before_now(days=5).isoformat()}, project_id=project.id
        )
        
        # Events inside period
        event_in_period_1 = self.store_event(
            data={"timestamp": before_now(hours=12).isoformat()}, project_id=project.id
        )
        event_in_period_2 = self.store_event(
            data={"timestamp": before_now(hours=6).isoformat()}, project_id=project.id
        )

        url = reverse(
            "sentry-api-0-project-events",
            kwargs={
                "organization_id_or_slug": project.organization.slug,
                "project_id_or_slug": project.slug,
            },
        )
        
        response = self.client.get(url, {"statsPeriod": "1d"}, format="json")

        assert response.status_code == 200, response.content
        assert len(response.data) == 2
        event_ids = {event["eventID"] for event in response.data}
        assert event_ids == {event_in_period_1.event_id, event_in_period_2.event_id}

    def test_invalid_start_end_parameters(self):
        """Test error handling for invalid start/end parameters"""
        self.login_as(user=self.user)

        project = self.create_project()

        url = reverse(
            "sentry-api-0-project-events",
            kwargs={
                "organization_id_or_slug": project.organization.slug,
                "project_id_or_slug": project.slug,
            },
        )
        
        # Test invalid start parameter only
        response = self.client.get(url, {"start": "invalid-date"}, format="json")
        assert response.status_code == 400
        assert "Invalid date range" in str(response.content)
        
        # Test only providing start without end
        response = self.client.get(url, {"start": before_now(days=1).isoformat()}, format="json")
        assert response.status_code == 400
        assert "start and end are both required" in str(response.content)
        
        # Test only providing end without start
        response = self.client.get(url, {"end": before_now(days=1).isoformat()}, format="json")
        assert response.status_code == 400
        assert "start and end are both required" in str(response.content)

    def test_invalid_stats_period_parameter(self):
        """Test error handling for invalid statsPeriod parameter"""
        self.login_as(user=self.user)

        project = self.create_project()

        url = reverse(
            "sentry-api-0-project-events",
            kwargs={
                "organization_id_or_slug": project.organization.slug,
                "project_id_or_slug": project.slug,
            },
        )
        
        response = self.client.get(url, {"statsPeriod": "invalid-period"}, format="json")
        assert response.status_code == 400
        assert "Invalid date range" in str(response.content)

    def test_stats_period_overrides_feature_flag(self):
        """Test that statsPeriod parameter overrides the feature flag date limit"""
        self.login_as(user=self.user)

        project = self.create_project()
        
        # Event older than 7 days (feature flag limit) but within statsPeriod
        event_old = self.store_event(
            data={"timestamp": before_now(days=10).isoformat()}, project_id=project.id
        )

        url = reverse(
            "sentry-api-0-project-events",
            kwargs={
                "organization_id_or_slug": project.organization.slug,
                "project_id_or_slug": project.slug,
            },
        )

        with self.feature("organizations:project-event-date-limit"):
            # With feature flag but no statsPeriod, should not return old event
            response = self.client.get(url, format="json")
            assert response.status_code == 200, response.content
            assert len(response.data) == 0
            
            # With statsPeriod parameter, should return old event
            response = self.client.get(url, {"statsPeriod": "14d"}, format="json")
            assert response.status_code == 200, response.content
            assert len(response.data) == 1
            assert response.data[0]["eventID"] == event_old.event_id

    def test_start_end_overrides_feature_flag(self):
        """Test that start/end parameters override the feature flag date limit"""
        self.login_as(user=self.user)

        project = self.create_project()
        
        # Event older than 7 days (feature flag limit) but within start/end range
        event_old = self.store_event(
            data={"timestamp": before_now(days=10).isoformat()}, project_id=project.id
        )

        url = reverse(
            "sentry-api-0-project-events",
            kwargs={
                "organization_id_or_slug": project.organization.slug,
                "project_id_or_slug": project.slug,
            },
        )

        with self.feature("organizations:project-event-date-limit"):
            # With feature flag but no date parameters, should not return old event
            response = self.client.get(url, format="json")
            assert response.status_code == 200, response.content
            assert len(response.data) == 0
            
            # With start/end parameters, should return old event
            start_time = before_now(days=15).isoformat()
            end_time = before_now(days=5).isoformat()
            response = self.client.get(url, {"start": start_time, "end": end_time}, format="json")
            assert response.status_code == 200, response.content
            assert len(response.data) == 1
            assert response.data[0]["eventID"] == event_old.event_id
