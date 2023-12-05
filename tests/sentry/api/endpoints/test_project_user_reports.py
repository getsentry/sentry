from datetime import datetime, timedelta
from unittest.mock import patch
from uuid import uuid4

from django.utils import timezone

from sentry.models.group import GroupStatus
from sentry.models.userreport import UserReport
from sentry.testutils.cases import APITestCase, SnubaTestCase
from sentry.testutils.helpers.datetime import before_now, iso_format
from sentry.testutils.silo import region_silo_test


@region_silo_test
class ProjectUserReportListTest(APITestCase, SnubaTestCase):
    def setUp(self):
        super().setUp()
        self.min_ago = iso_format(before_now(minutes=1))
        self.environment = self.create_environment(project=self.project, name="production")
        self.event = self.store_event(
            data={
                "event_id": "a" * 32,
                "timestamp": self.min_ago,
                "environment": self.environment.name,
            },
            project_id=self.project.id,
        )
        self.environment2 = self.create_environment(project=self.project, name="staging")
        self.event2 = self.store_event(
            data={
                "event_id": "b" * 32,
                "timestamp": self.min_ago,
                "environment": self.environment2.name,
            },
            project_id=self.project.id,
        )
        self.report = UserReport.objects.create(
            project_id=self.project.id,
            environment_id=self.environment.id,
            event_id="a" * 32,
            name="Foo",
            email="foo@example.com",
            comments="Hello world",
            group_id=self.event.group.id,
        )
        self.report2 = UserReport.objects.create(
            project_id=self.project.id,
            event_id="b" * 32,
            name="Foo",
            email="foo@example.com",
            comments="Hello world",
            group_id=self.event.group.id,
        )

    def test_simple(self):
        self.login_as(user=self.user)

        project = self.create_project()
        event1 = self.store_event(
            data={
                "timestamp": iso_format(datetime.utcnow()),
                "event_id": "a" * 32,
                "message": "something went wrong",
            },
            project_id=project.id,
        )
        group = event1.group
        event2 = self.store_event(
            data={
                "timestamp": iso_format(datetime.utcnow()),
                "event_id": "c" * 32,
                "message": "testing",
            },
            project_id=project.id,
        )
        group2 = event2.group
        group2.status = GroupStatus.RESOLVED
        group2.substatus = None
        group2.save()

        report_1 = UserReport.objects.create(
            project_id=project.id,
            event_id=event1.event_id,
            name="Foo",
            email="foo@example.com",
            comments="Hello world",
            group_id=group.id,
        )

        # should not be included due to missing link
        UserReport.objects.create(
            project_id=project.id,
            event_id="b" * 32,
            name="Bar",
            email="bar@example.com",
            comments="Hello world",
        )

        # should not be included due to resolution
        UserReport.objects.create(
            project_id=project.id,
            event_id=event2.event_id,
            name="Baz",
            email="baz@example.com",
            comments="Hello world",
            group_id=group2.id,
        )

        url = f"/api/0/projects/{project.organization.slug}/{project.slug}/user-feedback/"

        response = self.client.get(url, format="json")

        assert response.status_code == 200, response.content
        assert len(response.data) == 1
        assert sorted(map(lambda x: x["id"], response.data)) == sorted([str(report_1.id)])

    def test_cannot_access_with_dsn_auth(self):
        project = self.create_project()
        project_key = self.create_project_key(project=project)

        url = f"/api/0/projects/{project.organization.slug}/{project.slug}/user-feedback/"

        response = self.client.get(url, HTTP_AUTHORIZATION=f"DSN {project_key.dsn_public}")

        assert response.status_code == 401, response.content

    def test_all_reports(self):
        self.login_as(user=self.user)

        project = self.create_project()
        event = self.store_event(
            data={
                "timestamp": iso_format(datetime.utcnow()),
                "event_id": "a" * 32,
                "message": "testing",
            },
            project_id=project.id,
        )
        group = event.group
        report_1 = UserReport.objects.create(
            project_id=project.id,
            event_id="a" * 32,
            name="Foo",
            email="foo@example.com",
            comments="Hello world",
            group_id=group.id,
        )

        group.status = GroupStatus.RESOLVED
        group.substatus = None
        group.save()

        url = f"/api/0/projects/{project.organization.slug}/{project.slug}/user-feedback/"

        response = self.client.get(f"{url}?status=", format="json")

        assert response.status_code == 200, response.content
        assert len(response.data) == 1
        assert sorted(map(lambda x: x["id"], response.data)) == sorted([str(report_1.id)])

    def test_environments(self):
        self.login_as(user=self.user)

        base_url = (
            f"/api/0/projects/{self.project.organization.slug}/{self.project.slug}/user-feedback/"
        )

        # Specify environment
        response = self.client.get(base_url + "?environment=production")

        assert response.status_code == 200, response.content
        assert len(response.data) == 1
        assert response.data[0]["eventID"] == "a" * 32

        # No environment
        response = self.client.get(base_url + "?environment=")
        assert response.status_code == 200
        assert response.data == []

        # All environments
        response = self.client.get(base_url)

        assert response.status_code == 200, response.content
        assert len(response.data) == 2
        assert {report["eventID"] for report in response.data} == {"a" * 32, "b" * 32}

        # Invalid environment
        response = self.client.get(base_url + "?environment=invalid_env")
        assert response.status_code == 200
        assert response.data == []


@region_silo_test
class CreateProjectUserReportTest(APITestCase, SnubaTestCase):
    def setUp(self):
        super().setUp()
        self.min_ago = iso_format(before_now(minutes=1))
        self.hour_ago = iso_format(before_now(minutes=60))

        self.project = self.create_project()
        self.environment = self.create_environment(project=self.project)
        self.event = self.store_event(
            data={
                "timestamp": self.min_ago,
                "environment": self.environment.name,
                "user": {"email": "foo@example.com"},
            },
            project_id=self.project.id,
        )
        self.old_event = self.store_event(
            data={"timestamp": self.hour_ago, "environment": self.environment.name},
            project_id=self.project.id,
        )

    def test_simple(self):
        self.login_as(user=self.user)

        url = f"/api/0/projects/{self.project.organization.slug}/{self.project.slug}/user-feedback/"

        response = self.client.post(
            url,
            data={
                "event_id": self.event.event_id,
                "email": "foo@example.com",
                "name": "Foo Bar",
                "comments": "It broke!",
            },
        )

        assert response.status_code == 200, response.content

        report = UserReport.objects.get(id=response.data["id"])
        assert report.project_id == self.project.id
        assert report.group_id == self.event.group.id
        assert report.email == "foo@example.com"
        assert report.name == "Foo Bar"
        assert report.comments == "It broke!"

    def test_with_dsn_auth(self):
        project_key = self.create_project_key(project=self.project)
        url = f"/api/0/projects/{self.project.organization.slug}/{self.project.slug}/user-feedback/"

        response = self.client.post(
            url,
            HTTP_AUTHORIZATION=f"DSN {project_key.dsn_public}",
            data={
                "event_id": self.event.event_id,
                "email": "foo@example.com",
                "name": "Foo Bar",
                "comments": "It broke!",
            },
        )

        assert response.status_code == 200, response.content
        # DSN auth shouldn't return any data
        assert not response.data

    def test_with_dsn_auth_invalid_project(self):
        project2 = self.create_project()
        project_key = self.create_project_key(project=self.project)

        url = f"/api/0/projects/{project2.organization.slug}/{project2.slug}/user-feedback/"

        response = self.client.post(
            url,
            HTTP_AUTHORIZATION=f"DSN {project_key.dsn_public}",
            data={
                "event_id": uuid4().hex,
                "email": "foo@example.com",
                "name": "Foo Bar",
                "comments": "It broke!",
            },
        )

        assert response.status_code == 400, response.content

    def test_already_present(self):
        self.login_as(user=self.user)

        UserReport.objects.create(
            group_id=self.event.group.id,
            project_id=self.project.id,
            event_id=self.event.event_id,
            name="foo",
            email="bar@example.com",
            comments="",
        )

        url = f"/api/0/projects/{self.project.organization.slug}/{self.project.slug}/user-feedback/"

        response = self.client.post(
            url,
            data={
                "event_id": self.event.event_id,
                "email": "foo@example.com",
                "name": "Foo Bar",
                "comments": "It broke!",
            },
        )

        assert response.status_code == 200, response.content

        report = UserReport.objects.get(id=response.data["id"])
        assert report.project_id == self.project.id
        assert report.group_id == self.event.group.id
        assert report.email == "foo@example.com"
        assert report.name == "Foo Bar"
        assert report.comments == "It broke!"

    def test_already_present_after_deadline(self):
        self.login_as(user=self.user)

        UserReport.objects.create(
            group_id=self.old_event.group.id,
            project_id=self.project.id,
            event_id=self.old_event.event_id,
            name="foo",
            email="bar@example.com",
            comments="",
            date_added=timezone.now() - timedelta(minutes=10),
        )

        url = f"/api/0/projects/{self.project.organization.slug}/{self.project.slug}/user-feedback/"

        response = self.client.post(
            url,
            data={
                "event_id": self.old_event.event_id,
                "email": "foo@example.com",
                "name": "Foo Bar",
                "comments": "It broke!",
            },
        )

        assert response.status_code == 409, response.content

    def test_after_event_deadline(self):
        self.login_as(user=self.user)

        url = f"/api/0/projects/{self.project.organization.slug}/{self.project.slug}/user-feedback/"

        response = self.client.post(
            url,
            data={
                "event_id": self.old_event.event_id,
                "email": "foo@example.com",
                "name": "Foo Bar",
                "comments": "It broke!",
            },
        )

        assert response.status_code == 409, response.content

    def test_environments(self):
        self.login_as(user=self.user)

        url = f"/api/0/projects/{self.project.organization.slug}/{self.project.slug}/user-feedback/"

        response = self.client.post(
            url,
            data={
                "event_id": self.event.event_id,
                "email": "foo@example.com",
                "name": "Foo Bar",
                "comments": "It broke!",
            },
        )

        assert response.status_code == 200, response.content
        assert (
            UserReport.objects.get(event_id=self.event.event_id).environment_id
            == self.environment.id
        )

    @patch("sentry.feedback.usecases.create_feedback.produce_occurrence_to_kafka")
    def test_simple_shim_to_feedback(self, mock_produce_occurrence_to_kafka):
        replay_id = "b" * 32
        event_with_replay = self.store_event(
            data={
                "contexts": {"replay": {"replay_id": replay_id}},
                "event_id": "a" * 32,
                "timestamp": self.min_ago,
                "environment": self.environment.name,
            },
            project_id=self.project.id,
        )
        self.login_as(user=self.user)

        url = f"/api/0/projects/{self.project.organization.slug}/{self.project.slug}/user-feedback/"

        with self.feature("organizations:user-feedback-ingest"):
            response = self.client.post(
                url,
                data={
                    "event_id": event_with_replay.event_id,
                    "email": "foo@example.com",
                    "name": "Foo Bar",
                    "comments": "It broke!",
                },
            )

        assert response.status_code == 200, response.content

        report = UserReport.objects.get(id=response.data["id"])
        assert report.project_id == self.project.id
        assert report.group_id == event_with_replay.group.id
        assert report.email == "foo@example.com"
        assert report.name == "Foo Bar"
        assert report.comments == "It broke!"
        assert len(mock_produce_occurrence_to_kafka.mock_calls) == 1
        mock_event_data = mock_produce_occurrence_to_kafka.call_args_list[0][1]["event_data"]

        assert mock_event_data["contexts"]["feedback"]["contact_email"] == "foo@example.com"
        assert mock_event_data["contexts"]["feedback"]["message"] == "It broke!"
        assert mock_event_data["contexts"]["feedback"]["name"] == "Foo Bar"
        assert mock_event_data["contexts"]["feedback"]["replay_id"] == replay_id
        assert mock_event_data["contexts"]["replay"]["replay_id"] == replay_id
        assert mock_event_data["environment"] == self.environment.name

        assert mock_event_data["platform"] == "other"
        assert (
            mock_event_data["contexts"]["feedback"]["associated_event_id"]
            == event_with_replay.event_id
        )
        assert mock_event_data["level"] == "error"

    @patch("sentry.feedback.usecases.create_feedback.produce_occurrence_to_kafka")
    def test_simple_shim_to_feedback_no_event(self, mock_produce_occurrence_to_kafka):
        self.login_as(user=self.user)

        url = f"/api/0/projects/{self.project.organization.slug}/{self.project.slug}/user-feedback/"
        event_id = uuid4().hex
        with self.feature("organizations:user-feedback-ingest"):
            response = self.client.post(
                url,
                data={
                    "event_id": event_id,
                    "email": "foo@example.com",
                    "name": "Foo Bar",
                    "comments": "It broke!",
                },
            )

        assert response.status_code == 200, response.content

        report = UserReport.objects.get(id=response.data["id"])
        assert report.project_id == self.project.id
        assert report.email == "foo@example.com"
        assert report.name == "Foo Bar"
        assert report.comments == "It broke!"

        assert len(mock_produce_occurrence_to_kafka.mock_calls) == 1
        mock_event_data = mock_produce_occurrence_to_kafka.call_args_list[0][1]["event_data"]

        assert mock_event_data["contexts"]["feedback"]["contact_email"] == "foo@example.com"
        assert mock_event_data["contexts"]["feedback"]["message"] == "It broke!"
        assert mock_event_data["contexts"]["feedback"]["name"] == "Foo Bar"
        assert mock_event_data["platform"] == "other"
        assert mock_event_data["contexts"]["feedback"]["associated_event_id"] == event_id
        assert mock_event_data["level"] == "info"
