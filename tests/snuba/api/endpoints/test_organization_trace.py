import logging
from uuid import uuid4

from django.urls import reverse

from sentry.utils.samples import load_data
from tests.snuba.api.endpoints.test_organization_events_trace import (
    OrganizationEventsTraceEndpointBase,
)

logger = logging.getLogger(__name__)


class OrganizationEventsTraceEndpointTest(OrganizationEventsTraceEndpointBase):
    url_name = "sentry-api-0-organization-trace"
    FEATURES = ["organizations:trace-spans-format"]

    def assert_event(self, result, event_data, message):
        assert result["transaction"] == event_data.transaction, message
        assert result["event_id"] == event_data.data["contexts"]["trace"]["span_id"], message
        assert result["start_timestamp"] == event_data.data["start_timestamp"], message
        assert result["project_slug"] == event_data.project.slug, message
        assert result["sdk_name"] == event_data.data["sdk"]["name"], message
        assert result["transaction_id"] == event_data.event_id, message

    def get_transaction_children(self, event):
        """Assumes that the test setup only gives each event 1 txn child"""
        children = []
        for child in event["children"]:
            if child["is_transaction"]:
                children.append(child)
            elif child["event_type"] == "span":
                children.extend(child["children"])
        return sorted(children, key=lambda event: event["description"])

    def assert_trace_data(self, root, gen2_no_children=True):
        """see the setUp docstring for an idea of what the response structure looks like"""
        self.assert_event(root, self.root_event, "root")
        assert root["parent_span_id"] is None
        assert root["duration"] == 3000
        # 3 transactions, 2 child spans
        assert len(root["children"]) == 5
        transaction_children = self.get_transaction_children(root)
        assert len(transaction_children) == 3
        assert (
            root["measurements"]["measurements.lcp"]
            == self.root_event.data["measurements"]["lcp"]["value"]
        )
        assert (
            root["measurements"]["measurements.fcp"]
            == self.root_event.data["measurements"]["fcp"]["value"]
        )
        self.assert_performance_issues(root)

        for i, gen1 in enumerate(transaction_children):
            self.assert_event(gen1, self.gen1_events[i], f"gen1_{i}")
            assert gen1["parent_span_id"] == self.root_span_ids[i]
            assert gen1["duration"] == 2000
            assert len(gen1["children"]) == 1

            gen2 = self.get_transaction_children(gen1)[0]
            self.assert_event(gen2, self.gen2_events[i], f"gen2_{i}")
            assert gen2["parent_span_id"] == self.gen1_span_ids[i]
            assert gen2["duration"] == 1000

            # Only the first gen2 descendent has a child
            if i == 0:
                assert len(gen2["children"]) == 4
                gen3 = self.get_transaction_children(gen2)[0]
                self.assert_event(gen3, self.gen3_event, f"gen3_{i}")
                assert gen3["parent_span_id"] == self.gen2_span_id
                assert gen3["duration"] == 500
                assert len(gen3["children"]) == 0
            elif gen2_no_children:
                assert len(gen2["children"]) == 0

    def assert_performance_issues(self, root):
        """Broken in the non-spans endpoint, but we're not maintaining that anymore"""

    def client_get(self, data, url=None):
        if url is None:
            url = self.url
        return self.client.get(
            url,
            data,
            format="json",
        )

    def test_no_projects(self):
        user = self.create_user()
        org = self.create_organization(owner=user)
        self.login_as(user=user)

        url = reverse(
            self.url_name,
            kwargs={"organization_id_or_slug": org.slug, "trace_id": uuid4().hex},
        )

        with self.feature(self.FEATURES):
            response = self.client.get(
                url,
                format="json",
            )

        assert response.status_code == 404, response.content

    def test_simple(self):
        self.load_trace(is_eap=True)
        with self.feature(self.FEATURES):
            response = self.client_get(
                data={"timestamp": self.day_ago},
            )
        assert response.status_code == 200, response.content
        data = response.data
        assert len(data) == 1
        self.assert_trace_data(data[0])

    def test_ignore_project_param(self):
        self.load_trace(is_eap=True)
        with self.feature(self.FEATURES):
            # The trace endpoint should ignore the project param
            response = self.client_get(
                data={"project": self.project.id, "timestamp": self.day_ago},
            )
        assert response.status_code == 200, response.content
        data = response.data
        assert len(data) == 1
        self.assert_trace_data(data[0])

    def test_with_errors_data(self):
        self.load_trace(is_eap=True)
        _, start = self.get_start_end_from_day_ago(123)
        error_data = load_data(
            "javascript",
            timestamp=start,
        )
        error_data["contexts"]["trace"] = {
            "type": "trace",
            "trace_id": self.trace_id,
            "span_id": self.root_event.data["contexts"]["trace"]["span_id"],
        }
        error_data["tags"] = [["transaction", "/transaction/gen1-0"]]
        error = self.store_event(error_data, project_id=self.gen1_project.id)

        with self.feature(self.FEATURES):
            response = self.client_get(
                data={"timestamp": self.day_ago},
            )
        assert response.status_code == 200, response.content
        data = response.data
        assert len(data) == 1
        self.assert_trace_data(data[0])
        assert len(data[0]["errors"]) == 1
        error_event = data[0]["errors"][0]
        assert error_event is not None
        assert error_event["event_id"] == error.data["event_id"]
        assert error_event["project_slug"] == self.gen1_project.slug
        assert error_event["level"] == "error"
        assert error_event["issue_id"] == error.group_id
        assert error_event["start_timestamp"] == error_data["timestamp"]

    def test_with_errors_data_with_overlapping_span_id(self):
        self.load_trace(is_eap=True)
        _, start = self.get_start_end_from_day_ago(123)
        error_data = load_data(
            "javascript",
            timestamp=start,
        )
        error_data["contexts"]["trace"] = {
            "type": "trace",
            "trace_id": self.trace_id,
            "span_id": self.root_event.data["contexts"]["trace"]["span_id"],
        }
        error_data["tags"] = [["transaction", "/transaction/gen1-0"]]
        error = self.store_event(error_data, project_id=self.gen1_project.id)
        error_2 = self.store_event(error_data, project_id=self.gen1_project.id)

        with self.feature(self.FEATURES):
            response = self.client_get(
                data={"timestamp": self.day_ago},
            )
        assert response.status_code == 200, response.content
        data = response.data
        assert len(data) == 1
        self.assert_trace_data(data[0])
        assert len(data[0]["errors"]) == 2
        error_event_1 = data[0]["errors"][0]
        error_event_2 = data[0]["errors"][1]
        assert error_event_1["event_id"] in [error.event_id, error_2.event_id]
        assert error_event_2["event_id"] in [error.event_id, error_2.event_id]
        assert error_event_1["event_id"] != error_event_2["event_id"]

    def test_with_performance_issues(self):
        self.load_trace(is_eap=True)
        with self.feature(self.FEATURES):
            response = self.client_get(
                data={"timestamp": self.day_ago},
            )
        assert response.status_code == 200, response.content
        data = response.data
        assert len(data) == 1
        self.assert_trace_data(data[0])
        for child in data[0]["children"]:
            if child["event_id"] == "0012001200120012":
                break
        assert len(child["occurrences"]) == 1
        error_event = child["occurrences"][0]
        assert error_event is not None
        assert error_event["description"] == "File IO on Main Thread"
        assert error_event["project_slug"] == self.project.slug
        assert error_event["level"] == "info"

    def test_with_only_errors(self):
        start, _ = self.get_start_end_from_day_ago(1000)
        error_data = load_data(
            "javascript",
            timestamp=start,
        )
        error_data["contexts"]["trace"] = {
            "type": "trace",
            "trace_id": self.trace_id,
            "span_id": "a" * 16,
        }
        error_data["tags"] = [["transaction", "/transaction/gen1-0"]]
        error = self.store_event(error_data, project_id=self.project.id)

        with self.feature(self.FEATURES):
            response = self.client_get(
                data={"timestamp": self.day_ago},
            )
        assert response.status_code == 200, response.content
        data = response.data
        assert len(data) == 1
        assert data[0]["event_id"] == error.event_id

    def test_with_additional_attributes(self):
        self.load_trace(is_eap=True)
        with self.feature(self.FEATURES):
            response = self.client_get(
                data={
                    "timestamp": self.day_ago,
                    "additional_attributes": [
                        "gen_ai.request.model",
                        "gen_ai.usage.total_tokens",
                    ],
                },
            )
        assert response.status_code == 200, response.content
        data = response.data
        assert len(data) == 1

        # The root span doesn't have any of the additional attributes and returns defaults
        assert data[0]["additional_attributes"]["gen_ai.request.model"] == ""
        assert data[0]["additional_attributes"]["gen_ai.usage.total_tokens"] == 0

        assert data[0]["children"][0]["additional_attributes"]["gen_ai.request.model"] == "gpt-4o"
        assert data[0]["children"][0]["additional_attributes"]["gen_ai.usage.total_tokens"] == 100
