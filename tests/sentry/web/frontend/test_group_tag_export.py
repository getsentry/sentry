from datetime import datetime

from django.urls import reverse

from sentry.testutils import SnubaTestCase, TestCase
from sentry.testutils.helpers.datetime import before_now, iso_format
from sentry.testutils.silo import region_silo_test


@region_silo_test
class GroupTagExportTest(TestCase, SnubaTestCase):
    def setUp(self):
        super().setUp()
        self.url = None
        self.key = "foo"
        self.value = "b\xe4r"
        self.project = self.create_project()

        event_timestamp = iso_format(before_now(seconds=1))

        self.event = self.store_event(
            data={
                "tags": {self.key: self.value},
                "timestamp": event_timestamp,
                "environment": self.environment.name,
            },
            project_id=self.project.id,
            assert_no_errors=False,
        )

        self.group = self.event.group

        self.first_seen = datetime.strptime(event_timestamp, "%Y-%m-%dT%H:%M:%S").strftime(
            "%Y-%m-%dT%H:%M:%S.%fZ"
        )
        self.last_seen = self.first_seen
        self.login_as(user=self.user)

    def verify_test(self, response):
        assert response.status_code == 200
        assert response.streaming
        assert response["Content-Type"] == "text/csv"
        rows = list(response.streaming_content)
        for idx, row in enumerate(rows):
            row = row.decode("utf-8")
            assert row.endswith("\r\n")
            bits = row[:-2].split(",")
            if idx == 0:
                assert bits == ["value", "times_seen", "last_seen", "first_seen"]
            else:
                assert bits[0] == self.value
                assert bits[1] == "1"
                assert bits[2] == self.last_seen
                assert bits[3] == self.first_seen

    def test_simple(self):
        url = reverse(
            "sentry-group-tag-export",
            kwargs={
                "organization_slug": self.project.organization.slug,
                "project_slug": self.project.slug,
                "group_id": self.group.id,
                "key": self.key,
            },
        )
        self.url = f"{url}?environment={self.environment.name}"

        response = self.client.get(self.url)
        self.verify_test(response)

    def test_simple_customer_domain(self):
        url = reverse(
            "sentry-customer-domain-sentry-group-tag-export",
            kwargs={
                "project_slug": self.project.slug,
                "group_id": self.group.id,
                "key": self.key,
            },
        )
        self.url = f"{url}?environment={self.environment.name}"

        response = self.client.get(
            self.url, SERVER_NAME=f"{self.project.organization.slug}.testserver"
        )
        self.verify_test(response)
