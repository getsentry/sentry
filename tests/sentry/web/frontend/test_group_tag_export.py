from typing import int
from datetime import datetime

from django.test import override_settings
from django.urls import reverse
from django.utils import timezone

from sentry.testutils.cases import SnubaTestCase, TestCase
from sentry.testutils.helpers.datetime import before_now, freeze_time
from sentry.testutils.silo import create_test_regions, region_silo_test


@region_silo_test(regions=create_test_regions("us"))
class GroupTagExportTest(TestCase, SnubaTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.url: str | None = None
        self.key = "foo"
        self.value = "b\xe4r"
        self.project = self.create_project()

        event_timestamp = before_now(seconds=1).replace(microsecond=0).isoformat()

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

        self.first_seen = datetime.fromisoformat(event_timestamp).strftime("%Y-%m-%dT%H:%M:%S.%fZ")
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

    def test_simple(self) -> None:
        url = reverse(
            "sentry-group-tag-export",
            kwargs={
                "organization_slug": self.project.organization.slug,
                "project_id_or_slug": self.project.slug,
                "group_id": self.group.id,
                "key": self.key,
            },
        )
        self.url = f"{url}?environment={self.environment.name}"

        response = self.client.get(self.url)
        self.verify_test(response)

    def test_simple_customer_domain(self) -> None:
        url = reverse(
            "sentry-customer-domain-sentry-group-tag-export",
            kwargs={
                "project_id_or_slug": self.project.slug,
                "group_id": self.group.id,
                "key": self.key,
            },
        )
        self.url = f"{url}?environment={self.environment.name}"

        response = self.client.get(
            self.url, HTTP_HOST=f"{self.project.organization.slug}.testserver"
        )
        self.verify_test(response)

    def test_region_subdomain_no_conflict_with_slug(self) -> None:
        # When a request to a web view contains both
        # a region subdomain and org slug, we shouldn't conflate
        # the subdomain as being an org slug.
        # We're using this endpoint because it is the only view that
        # accepts organization_slug at time of writing.
        url = reverse(
            "sentry-customer-domain-sentry-group-tag-export",
            kwargs={
                "project_id_or_slug": self.project.slug,
                "group_id": self.group.id,
                "key": self.key,
            },
        )
        resp = self.client.get(url, HTTP_HOST="us.testserver")
        assert resp.status_code == 200
        assert "Location" not in resp

    @override_settings(SENTRY_SELF_HOSTED=False)
    def test_rate_limit(self) -> None:
        url = reverse(
            "sentry-group-tag-export",
            kwargs={
                "organization_slug": self.project.organization.slug,
                "project_id_or_slug": self.project.slug,
                "group_id": self.group.id,
                "key": self.key,
            },
        )
        self.url = f"{url}?environment={self.environment.name}"

        now = timezone.now()
        with freeze_time(now):
            # Make 10 requests within the limit (limit is 10 per user per minute)
            for i in range(10):
                response = self.client.get(self.url)
                assert response.status_code == 200

            # The 11th request should be rate limited
            response = self.client.get(self.url)
            assert response.status_code == 429
