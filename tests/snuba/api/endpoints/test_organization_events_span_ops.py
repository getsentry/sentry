from datetime import timedelta

import pytest
from django.urls import reverse

from sentry.testutils.cases import APITestCase, SnubaTestCase
from sentry.testutils.helpers.datetime import before_now, iso_format
from sentry.testutils.silo import region_silo_test
from sentry.utils.samples import load_data


@region_silo_test
class OrganizationEventsSpanOpsEndpointBase(APITestCase, SnubaTestCase):
    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)

        self.url = reverse(
            "sentry-api-0-organization-events-span-ops",
            kwargs={"organization_slug": self.organization.slug},
        )

        self.min_ago = before_now(minutes=1).replace(microsecond=0)

    def create_event(self, **kwargs):
        if "span_id" not in kwargs:
            kwargs["span_id"] = "a" * 16

        if "start_timestamp" not in kwargs:
            kwargs["start_timestamp"] = self.min_ago

        if "timestamp" not in kwargs:
            kwargs["timestamp"] = self.min_ago + timedelta(seconds=8)

        if "trace_context" not in kwargs:
            # should appear for all of the pXX metrics
            kwargs["trace_context"] = {
                "op": "http.server",
                "hash": "ab" * 8,
                "exclusive_time": 4.0,
            }

        if "spans" not in kwargs:
            kwargs["spans"] = [
                # should appear for the sum metric
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
                # should appear for the count metric
                {
                    "same_process_as_parent": True,
                    "parent_span_id": "a" * 16,
                    "span_id": x * 16,
                    "start_timestamp": iso_format(self.min_ago + timedelta(seconds=4)),
                    "timestamp": iso_format(self.min_ago + timedelta(seconds=5)),
                    "op": "django.view",
                    "description": "view span",
                    "hash": "ef" * 8,
                    "exclusive_time": 1.0,
                }
                for x in ["d", "e", "f"]
            ]

        data = load_data("transaction", **kwargs)
        data["transaction"] = "root transaction"

        return self.store_event(data, project_id=self.project.id)

    @pytest.mark.skip("setting snuba config is too slow")
    def test_basic(self):
        self.create_event()

        response = self.client.get(
            self.url,
            data={
                "project": self.project.id,
            },
            format="json",
        )

        assert response.status_code == 200, response.content
        assert response.data == [
            {"op": "django.view", "count": 3},
            {"op": "django.middleware", "count": 2},
            {"op": "http.server", "count": 1},
        ]
