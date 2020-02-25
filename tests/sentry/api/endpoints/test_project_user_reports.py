from __future__ import absolute_import
import six
from datetime import timedelta
from django.utils import timezone
from uuid import uuid4

from sentry.testutils import APITestCase, SnubaTestCase
from sentry.testutils.helpers.datetime import iso_format, before_now
from sentry.models import EventUser, GroupStatus, UserReport
from sentry.utils.compat import map


class ProjectUserReportListTest(APITestCase, SnubaTestCase):
    def setUp(self):
        super(ProjectUserReportListTest, self).setUp()
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
            project=self.project,
            environment=self.environment,
            event_id="a" * 32,
            name="Foo",
            email="foo@example.com",
            comments="Hello world",
            group=self.event.group,
        )
        self.report2 = UserReport.objects.create(
            project=self.project,
            event_id="b" * 32,
            name="Foo",
            email="foo@example.com",
            comments="Hello world",
            group=self.event.group,
        )

    def test_simple(self):
        self.login_as(user=self.user)

        project = self.create_project()
        group = self.create_group(project=project)
        group2 = self.create_group(project=project, status=GroupStatus.RESOLVED)
        report_1 = UserReport.objects.create(
            project=project,
            event_id="a" * 32,
            name="Foo",
            email="foo@example.com",
            comments="Hello world",
            group=group,
        )

        # should not be included due to missing link
        UserReport.objects.create(
            project=project,
            event_id="b" * 32,
            name="Bar",
            email="bar@example.com",
            comments="Hello world",
        )

        # should not be included due to resolution
        UserReport.objects.create(
            project=project,
            event_id="c" * 32,
            name="Baz",
            email="baz@example.com",
            comments="Hello world",
            group=group2,
        )

        url = u"/api/0/projects/{}/{}/user-feedback/".format(
            project.organization.slug, project.slug
        )

        response = self.client.get(url, format="json")

        assert response.status_code == 200, response.content
        assert len(response.data) == 1
        assert sorted(map(lambda x: x["id"], response.data)) == sorted([six.text_type(report_1.id)])

    def test_cannot_access_with_dsn_auth(self):
        project = self.create_project()
        project_key = self.create_project_key(project=project)

        url = u"/api/0/projects/{}/{}/user-feedback/".format(
            project.organization.slug, project.slug
        )

        response = self.client.get(url, HTTP_AUTHORIZATION=u"DSN {}".format(project_key.dsn_public))

        assert response.status_code == 401, response.content

    def test_all_reports(self):
        self.login_as(user=self.user)

        project = self.create_project()
        group = self.create_group(project=project, status=GroupStatus.RESOLVED)
        report_1 = UserReport.objects.create(
            project=project,
            event_id="a" * 32,
            name="Foo",
            email="foo@example.com",
            comments="Hello world",
            group=group,
        )

        url = u"/api/0/projects/{}/{}/user-feedback/".format(
            project.organization.slug, project.slug
        )

        response = self.client.get(u"{}?status=".format(url), format="json")

        assert response.status_code == 200, response.content
        assert len(response.data) == 1
        assert sorted(map(lambda x: x["id"], response.data)) == sorted([six.text_type(report_1.id)])

    def test_environments(self):
        self.login_as(user=self.user)

        base_url = u"/api/0/projects/{}/{}/user-feedback/".format(
            self.project.organization.slug, self.project.slug
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
        assert set([report["eventID"] for report in response.data]) == set(["a" * 32, "b" * 32])

        # Invalid environment
        response = self.client.get(base_url + "?environment=invalid_env")
        assert response.status_code == 200
        assert response.data == []


class CreateProjectUserReportTest(APITestCase, SnubaTestCase):
    def setUp(self):
        super(CreateProjectUserReportTest, self).setUp()
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

        url = u"/api/0/projects/{}/{}/user-feedback/".format(
            self.project.organization.slug, self.project.slug
        )

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
        assert report.project == self.project
        assert report.group == self.event.group
        assert report.email == "foo@example.com"
        assert report.name == "Foo Bar"
        assert report.comments == "It broke!"

    def test_with_dsn_auth(self):
        project_key = self.create_project_key(project=self.project)
        url = u"/api/0/projects/{}/{}/user-feedback/".format(
            self.project.organization.slug, self.project.slug
        )

        response = self.client.post(
            url,
            HTTP_AUTHORIZATION=u"DSN {}".format(project_key.dsn_public),
            data={
                "event_id": self.event.event_id,
                "email": "foo@example.com",
                "name": "Foo Bar",
                "comments": "It broke!",
            },
        )

        assert response.status_code == 200, response.content

    def test_with_dsn_auth_invalid_project(self):
        project2 = self.create_project()
        project_key = self.create_project_key(project=self.project)

        url = u"/api/0/projects/{}/{}/user-feedback/".format(
            project2.organization.slug, project2.slug
        )

        response = self.client.post(
            url,
            HTTP_AUTHORIZATION=u"DSN {}".format(project_key.dsn_public),
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
            group=self.event.group,
            project=self.project,
            event_id=self.event.event_id,
            name="foo",
            email="bar@example.com",
            comments="",
        )

        url = u"/api/0/projects/{}/{}/user-feedback/".format(
            self.project.organization.slug, self.project.slug
        )

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
        assert report.project == self.project
        assert report.group == self.event.group
        assert report.email == "foo@example.com"
        assert report.name == "Foo Bar"
        assert report.comments == "It broke!"

    def test_already_present_with_matching_user(self):
        self.login_as(user=self.user)

        euser = EventUser.objects.get(project_id=self.project.id, email="foo@example.com")

        UserReport.objects.create(
            group=self.event.group,
            project=self.project,
            event_id=self.event.event_id,
            name="foo",
            email="bar@example.com",
            comments="",
        )

        url = u"/api/0/projects/{}/{}/user-feedback/".format(
            self.project.organization.slug, self.project.slug
        )

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
        assert report.project == self.project
        assert report.group == self.event.group
        assert report.email == "foo@example.com"
        assert report.name == "Foo Bar"
        assert report.comments == "It broke!"
        assert report.event_user_id == euser.id

        euser = EventUser.objects.get(id=euser.id)
        assert euser.name == "Foo Bar"

    def test_already_present_after_deadline(self):
        self.login_as(user=self.user)

        UserReport.objects.create(
            group=self.old_event.group,
            project=self.project,
            event_id=self.old_event.event_id,
            name="foo",
            email="bar@example.com",
            comments="",
            date_added=timezone.now() - timedelta(minutes=10),
        )

        url = u"/api/0/projects/{}/{}/user-feedback/".format(
            self.project.organization.slug, self.project.slug
        )

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

        url = u"/api/0/projects/{}/{}/user-feedback/".format(
            self.project.organization.slug, self.project.slug
        )

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

        url = u"/api/0/projects/{}/{}/user-feedback/".format(
            self.project.organization.slug, self.project.slug
        )

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
        assert UserReport.objects.get(event_id=self.event.event_id).environment == self.environment
