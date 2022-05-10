from datetime import timedelta
from unittest.mock import patch
from urllib.parse import urlencode

import pytest
import pytz

from sentry.testutils.cases import AcceptanceTestCase, SnubaTestCase
from sentry.testutils.helpers.datetime import before_now, iso_format
from sentry.utils.samples import load_data
from tests.acceptance.page_objects.base import BasePage

FEATURES = {
    "organizations:performance-span-histogram-view": True,
    "organizations:performance-view": True,
    "organizations:performance-suspect-spans-view": True,
}


class PerformanceSpanSummaryTest(AcceptanceTestCase, SnubaTestCase):
    def setUp(self):
        super().setUp()
        self.org = self.create_organization(owner=self.user, name="Rowdy Tiger")
        self.team = self.create_team(
            organization=self.org, name="Mariachi Band", members=[self.user]
        )
        self.project = self.create_project(organization=self.org, teams=[self.team], name="Bengal")
        self.group = self.create_group(project=self.project)
        self.login_as(self.user)
        self.path = "/organizations/{}/performance/summary/spans/{}/?{}".format(
            self.org.slug,
            "django.middleware:" + "cd" * 8,
            urlencode({"project": self.project.id, "transaction": "root transaction"}),
        )
        self.page = BasePage(self.browser)
        self.min_ago = before_now(minutes=1).replace(microsecond=0)

    def create_event(self, **kwargs):
        if "span_id" not in kwargs:
            kwargs["span_id"] = "a" * 16

        if "start_timestamp" not in kwargs:
            kwargs["start_timestamp"] = self.min_ago

        if "timestamp" not in kwargs:
            kwargs["timestamp"] = self.min_ago + timedelta(seconds=8)

        if "trace_context" not in kwargs:
            kwargs["trace_context"] = {
                "op": "http.server",
                "hash": "ab" * 8,
                "exclusive_time": 4.0,
            }

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
                    "exclusive_time": 1.0,
                }
                for x in ["d", "e", "f"]
            ]

        data = load_data("transaction", **kwargs)
        data["transaction"] = "root transaction"
        data["event_id"] = "c" * 32
        data["contexts"]["trace"]["trace_id"] = "a" * 32

        return self.store_event(data, project_id=self.project.id)

    @pytest.mark.skip(reason="Has been flaky lately.")
    @patch("django.utils.timezone.now")
    def test_with_data(self, mock_now):
        mock_now.return_value = before_now().replace(tzinfo=pytz.utc)

        self.create_event()

        with self.feature(FEATURES):
            self.browser.get(self.path)
            self.page.wait_until_loaded()
            # Wait again for loaders inside the table
            self.page.wait_until_loaded()
            self.browser.snapshot("performance span summary - with data")
