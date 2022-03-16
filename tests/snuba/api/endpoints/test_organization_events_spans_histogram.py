from datetime import timedelta

from django.urls import reverse

from sentry.testutils.cases import APITestCase, SnubaTestCase
from sentry.testutils.helpers.datetime import before_now, iso_format
from sentry.utils.samples import load_data


class OrganizationEventsSpansHistogramEndpointTest(APITestCase, SnubaTestCase):
    FEATURES = ["organizations:performance-span-histogram-view"]
    URL = "sentry-api-0-organization-events-spans-histogram"

    def setUp(self):
        super().setUp()
        self.features = {}
        self.login_as(user=self.user)
        self.org = self.create_organization(owner=self.user)
        self.project = self.create_project(organization=self.org)
        self.url = reverse(
            self.URL,
            kwargs={"organization_slug": self.org.slug},
        )

        self.min_ago = before_now(minutes=1).replace(microsecond=0)
        self.day_ago = before_now(days=1).replace(hour=10, minute=0, second=0, microsecond=0)

    def create_event(self, **kwargs):
        if "start_timestamp" not in kwargs:
            kwargs["start_timestamp"] = self.min_ago

        if "timestamp" not in kwargs:
            kwargs["timestamp"] = self.min_ago + timedelta(seconds=8)

        if "spans" not in kwargs:
            kwargs["spans"] = [
                {
                    "same_process_as_parent": True,
                    "parent_span_id": "a" * 16,
                    "span_id": x * 16,
                    "start_timestamp": iso_format(self.min_ago + timedelta(seconds=1)),
                    "timestamp": iso_format(self.min_ago + timedelta(seconds=4)),
                    "op": "django.middleware",
                    "description": "middleware span",
                    "hash": "cd" * 8,
                    "exclusive_time": 3.0,
                }
                for x in ["b", "c"]
            ] + [
                {
                    "same_process_as_parent": True,
                    "parent_span_id": "a" * 16,
                    "span_id": x * 16,
                    "start_timestamp": iso_format(self.min_ago + timedelta(seconds=4)),
                    "timestamp": iso_format(self.min_ago + timedelta(seconds=5)),
                    "op": "django.middleware",
                    "description": "middleware span",
                    "hash": "cd" * 8,
                    "exclusive_time": 10.0,
                }
                for x in ["d", "e", "f"]
            ]

        data = load_data("transaction", **kwargs)
        data["transaction"] = "root transaction"

        return self.store_event(data, project_id=self.project.id)

    def test_no_feature(self):
        response = self.client.get(self.url, format="json")
        assert response.status_code == 404, response.content

    def test_no_projects(self):
        with self.feature(self.FEATURES):
            response = self.client.get(
                self.url, data={"projects": [-1], "span": f"django.middleware:{'cd'* 8}"}
            )

        assert response.status_code == 200, response.content
        assert response.data == {}

    def test_endpoint(self):
        self.create_event()

        with self.feature(self.FEATURES):
            response = self.client.get(
                self.url,
                data={
                    "project": [self.project.id],
                    "span": f"django.middleware:{'cd'* 8}",
                    "numBuckets": 100,
                },
                format="json",
            )

        label = f"spans_histogram__django_middleware__{'cd' * 8}_1_0_1"
        assert response.status_code == 200, response.content
        assert response.data["data"] == [{label: 3, "count": 2}, {label: 10, "count": 3}]
