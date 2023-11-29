from datetime import timedelta
from unittest import mock
from uuid import uuid4

import pytest
from django.urls import NoReverseMatch, reverse

from sentry import options
from sentry.issues.grouptype import NoiseConfig, PerformanceFileIOMainThreadGroupType
from sentry.testutils.cases import APITestCase, SnubaTestCase
from sentry.testutils.helpers import override_options
from sentry.testutils.helpers.datetime import before_now, iso_format
from sentry.testutils.silo import region_silo_test
from sentry.utils.dates import to_timestamp_from_iso_format
from sentry.utils.samples import load_data


class OrganizationEventsTraceEndpointBase(APITestCase, SnubaTestCase):
    url_name: str
    FEATURES = [
        "organizations:performance-view",
        "organizations:performance-file-io-main-thread-detector",
        "organizations:trace-view-load-more",
    ]

    def get_start_end(self, duration):
        return self.day_ago, self.day_ago + timedelta(milliseconds=duration)

    def create_event(
        self,
        trace,
        transaction,
        spans,
        parent_span_id,
        project_id,
        tags=None,
        duration=4000,
        span_id=None,
        measurements=None,
        file_io_performance_issue=False,
        **kwargs,
    ):
        start, end = self.get_start_end(duration)
        data = load_data(
            "transaction",
            trace=trace,
            spans=spans,
            timestamp=end,
            start_timestamp=start,
        )
        data["transaction"] = transaction
        data["contexts"]["trace"]["parent_span_id"] = parent_span_id
        if span_id:
            data["contexts"]["trace"]["span_id"] = span_id
        if measurements:
            for key, value in measurements.items():
                data["measurements"][key]["value"] = value
        if tags is not None:
            data["tags"] = tags
        if file_io_performance_issue:
            span = data["spans"][0]
            if "data" not in span:
                span["data"] = {}
            span["op"] = "file.write"
            span["data"].update({"duration": 1, "blocked_main_thread": True})
        with self.feature(self.FEATURES):
            with mock.patch.object(
                PerformanceFileIOMainThreadGroupType,
                "noise_config",
                new=NoiseConfig(0, timedelta(minutes=1)),
            ), override_options(
                {
                    "performance.issues.all.problem-detection": 1.0,
                    "performance-file-io-main-thread-creation": 1.0,
                }
            ):
                return self.store_event(data, project_id=project_id, **kwargs)

    def setUp(self):
        """
        Span structure:

        root
            gen1-0
                gen2-0
                    gen3-0
            gen1-1
                gen2-1
            gen1-2
                gen2-2
        """
        super().setUp()
        options.set("performance.issues.all.problem-detection", 1.0)
        options.set("performance.issues.file_io_main_thread.problem-creation", 1.0)
        self.login_as(user=self.user)

        self.day_ago = before_now(days=1).replace(hour=10, minute=0, second=0, microsecond=0)
        self.root_span_ids = [uuid4().hex[:16] for _ in range(3)]
        self.trace_id = uuid4().hex

        self.url = reverse(
            self.url_name,
            kwargs={"organization_slug": self.project.organization.slug, "trace_id": self.trace_id},
        )

    def load_trace(self):
        self.root_event = self.create_event(
            trace=self.trace_id,
            transaction="root",
            spans=[
                {
                    "same_process_as_parent": True,
                    "op": "http",
                    "description": f"GET gen1-{i}",
                    "span_id": root_span_id,
                    "trace_id": self.trace_id,
                }
                for i, root_span_id in enumerate(self.root_span_ids)
            ],
            measurements={
                "lcp": 1000,
                "fcp": 750,
            },
            parent_span_id=None,
            file_io_performance_issue=True,
            project_id=self.project.id,
            duration=3000,
        )

        # First Generation
        self.gen1_span_ids = [uuid4().hex[:16] for _ in range(3)]
        self.gen1_project = self.create_project(organization=self.organization)
        self.gen1_events = [
            self.create_event(
                trace=self.trace_id,
                transaction=f"/transaction/gen1-{i}",
                spans=[
                    {
                        "same_process_as_parent": True,
                        "op": "http",
                        "description": f"GET gen2-{i}",
                        "span_id": gen1_span_id,
                        "trace_id": self.trace_id,
                    }
                ],
                parent_span_id=root_span_id,
                project_id=self.gen1_project.id,
                duration=2000,
            )
            for i, (root_span_id, gen1_span_id) in enumerate(
                zip(self.root_span_ids, self.gen1_span_ids)
            )
        ]

        # Second Generation
        self.gen2_span_ids = [uuid4().hex[:16] for _ in range(3)]
        self.gen2_project = self.create_project(organization=self.organization)

        # Intentially pick a span id that starts with 0s
        self.gen2_span_id = "0011" * 4

        self.gen2_events = [
            self.create_event(
                trace=self.trace_id,
                transaction=f"/transaction/gen2-{i}",
                spans=[
                    {
                        "same_process_as_parent": True,
                        "op": "http",
                        "description": f"GET gen3-{i}" if i == 0 else f"SPAN gen3-{i}",
                        "span_id": gen2_span_id,
                        "trace_id": self.trace_id,
                    }
                ],
                parent_span_id=gen1_span_id,
                span_id=self.gen2_span_id if i == 0 else None,
                project_id=self.gen2_project.id,
                duration=1000,
            )
            for i, (gen1_span_id, gen2_span_id) in enumerate(
                zip(self.gen1_span_ids, self.gen2_span_ids)
            )
        ]

        # Third generation
        self.gen3_project = self.create_project(organization=self.organization)
        self.gen3_event = self.create_event(
            trace=self.trace_id,
            transaction="/transaction/gen3-0",
            spans=[],
            project_id=self.gen3_project.id,
            parent_span_id=self.gen2_span_id,
            duration=500,
        )

    def load_errors(self):
        start, _ = self.get_start_end(1000)
        error_data = load_data(
            "javascript",
            timestamp=start,
        )
        error_data["contexts"]["trace"] = {
            "type": "trace",
            "trace_id": self.trace_id,
            "span_id": self.gen1_span_ids[0],
        }
        error_data["level"] = "fatal"
        error = self.store_event(error_data, project_id=self.gen1_project.id)
        error_data["level"] = "warning"
        error1 = self.store_event(error_data, project_id=self.gen1_project.id)
        return error, error1

    def load_default(self):
        start, _ = self.get_start_end(1000)
        return self.store_event(
            {
                "timestamp": iso_format(start),
                "contexts": {
                    "trace": {
                        "type": "trace",
                        "trace_id": self.trace_id,
                        "span_id": self.root_span_ids[0],
                    },
                },
                "level": "debug",
                "message": "this is a log message",
            },
            project_id=self.gen1_project.id,
        )


@region_silo_test
class OrganizationEventsTraceLightEndpointTest(OrganizationEventsTraceEndpointBase):
    url_name = "sentry-api-0-organization-events-trace-light"

    def test_no_projects(self):
        user = self.create_user()
        org = self.create_organization(owner=user)
        self.login_as(user=user)

        url = reverse(
            self.url_name,
            kwargs={"organization_slug": org.slug, "trace_id": uuid4().hex},
        )

        with self.feature(self.FEATURES):
            response = self.client.get(
                url,
                format="json",
            )

        assert response.status_code == 404, response.content

    def test_bad_ids(self):
        # Fake event id
        with self.feature(self.FEATURES):
            response = self.client.get(
                self.url,
                data={"event_id": uuid4().hex},
                format="json",
            )

        assert response.status_code == 404, response.content

        # Invalid event id
        with self.feature(self.FEATURES):
            response = self.client.get(
                self.url,
                data={"event_id": "not-a-event"},
                format="json",
            )

        assert response.status_code == 400, response.content

        # Fake trace id
        self.url = reverse(
            "sentry-api-0-organization-events-trace-light",
            kwargs={"organization_slug": self.project.organization.slug, "trace_id": uuid4().hex},
        )

        with self.feature(self.FEATURES):
            response = self.client.get(
                self.url,
                data={"event_id": "a" * 32},
                format="json",
            )

        assert response.status_code == 404, response.content

        # Invalid trace id
        with pytest.raises(NoReverseMatch):
            self.url = reverse(
                "sentry-api-0-organization-events-trace-light",
                kwargs={
                    "organization_slug": self.project.organization.slug,
                    "trace_id": "not-a-trace",
                },
            )

    def test_no_roots(self):
        """Even when there's no root, we return the current event"""
        self.load_trace()
        no_root_trace = uuid4().hex
        parent_span_id = uuid4().hex[:16]
        no_root_event = self.create_event(
            trace=no_root_trace,
            transaction="/not_root/but_only_transaction",
            spans=[],
            parent_span_id=parent_span_id,
            project_id=self.project.id,
        )
        url = reverse(
            "sentry-api-0-organization-events-trace-light",
            kwargs={"organization_slug": self.project.organization.slug, "trace_id": no_root_trace},
        )

        with self.feature(self.FEATURES):
            response = self.client.get(
                url,
                data={"event_id": no_root_event.event_id},
                format="json",
            )

        assert response.status_code == 200, response.content
        assert len(response.data["transactions"]) == 1

        event = response.data["transactions"][0]
        # Basically know nothing about this event
        assert event["generation"] is None
        assert event["parent_event_id"] is None
        assert event["parent_span_id"] == parent_span_id
        assert event["event_id"] == no_root_event.event_id

    def test_multiple_roots(self):
        self.load_trace()
        second_root = self.create_event(
            trace=self.trace_id,
            transaction="/second_root",
            spans=[],
            parent_span_id=None,
            project_id=self.project.id,
        )
        with self.feature(self.FEATURES):
            response = self.client.get(
                self.url,
                data={"event_id": second_root.event_id, "project": -1},
                format="json",
            )

        assert response.status_code == 200, response.content
        assert len(response.data["transactions"]) == 1

        event = response.data["transactions"][0]
        assert event["generation"] == 0
        assert event["parent_event_id"] is None
        assert event["parent_span_id"] is None

    def test_root_event(self):
        self.load_trace()
        root_event_id = self.root_event.event_id
        with self.feature(self.FEATURES):
            response = self.client.get(
                self.url,
                data={"event_id": root_event_id, "project": -1},
                format="json",
            )

        assert response.status_code == 200, response.content
        assert len(response.data["transactions"]) == 4
        events = {item["event_id"]: item for item in response.data["transactions"]}

        assert root_event_id in events
        event = events[root_event_id]
        assert event["generation"] == 0
        assert event["parent_event_id"] is None
        assert event["parent_span_id"] is None

        for i, child_event in enumerate(self.gen1_events):
            child_event_id = child_event.event_id
            assert child_event_id in events
            event = events[child_event_id]
            assert event["generation"] == 1
            assert event["parent_event_id"] == root_event_id
            assert event["parent_span_id"] == self.root_span_ids[i]

    def test_root_with_multiple_roots(self):
        self.load_trace()
        root_event_id = self.root_event.event_id
        self.create_event(
            trace=self.trace_id,
            transaction="/second_root",
            spans=[],
            parent_span_id=None,
            project_id=self.project.id,
        )
        with self.feature(self.FEATURES):
            response = self.client.get(
                self.url,
                data={"event_id": self.root_event.event_id},
                format="json",
            )

        assert response.status_code == 200, response.content

        assert len(response.data["transactions"]) == 4
        events = {item["event_id"]: item for item in response.data["transactions"]}

        assert root_event_id in events
        event = events[root_event_id]
        assert event["generation"] == 0
        assert event["parent_event_id"] is None
        assert event["parent_span_id"] is None

        for i, child_event in enumerate(self.gen1_events):
            child_event_id = child_event.event_id
            assert child_event_id in events
            event = events[child_event_id]
            assert event["generation"] == 1
            assert event["parent_event_id"] == root_event_id
            assert event["parent_span_id"] == self.root_span_ids[i]

    def test_direct_parent_with_children(self):
        self.load_trace()
        root_event_id = self.root_event.event_id
        current_event = self.gen1_events[0].event_id
        child_event_id = self.gen2_events[0].event_id

        with self.feature(self.FEATURES):
            response = self.client.get(
                self.url,
                data={"event_id": current_event, "project": -1},
                format="json",
            )

        assert response.status_code == 200, response.content

        assert len(response.data["transactions"]) == 3
        events = {item["event_id"]: item for item in response.data["transactions"]}

        assert root_event_id in events
        event = events[root_event_id]
        assert event["generation"] == 0
        assert event["parent_event_id"] is None
        assert event["parent_span_id"] is None

        assert current_event in events
        event = events[current_event]
        assert event["generation"] == 1
        assert event["parent_event_id"] == root_event_id
        assert event["parent_span_id"] == self.root_span_ids[0]

        assert child_event_id in events
        event = events[child_event_id]
        assert event["generation"] == 2
        assert event["parent_event_id"] == current_event
        assert event["parent_span_id"] == self.gen1_span_ids[0]

    def test_direct_parent_with_children_and_multiple_root(self):
        self.load_trace()
        root_event_id = self.root_event.event_id
        current_event = self.gen1_events[0].event_id
        child_event_id = self.gen2_events[0].event_id
        self.create_event(
            trace=self.trace_id,
            transaction="/second_root",
            spans=[],
            parent_span_id=None,
            project_id=self.project.id,
        )

        with self.feature(self.FEATURES):
            response = self.client.get(
                self.url,
                data={"event_id": current_event, "project": -1},
                format="json",
            )

        assert response.status_code == 200, response.content

        assert len(response.data["transactions"]) == 3
        events = {item["event_id"]: item for item in response.data["transactions"]}

        assert root_event_id in events
        event = events[root_event_id]
        assert event["generation"] == 0
        assert event["parent_event_id"] is None
        assert event["parent_span_id"] is None

        assert current_event in events
        event = events[current_event]
        assert event["generation"] == 1
        assert event["parent_event_id"] == root_event_id
        assert event["parent_span_id"] == self.root_span_ids[0]

        assert child_event_id in events
        event = events[child_event_id]
        assert event["generation"] == 2
        assert event["parent_event_id"] == current_event
        assert event["parent_span_id"] == self.gen1_span_ids[0]

    def test_second_generation_with_children(self):
        self.load_trace()
        current_event = self.gen2_events[0].event_id
        child_event_id = self.gen3_event.event_id

        with self.feature(self.FEATURES):
            response = self.client.get(
                self.url,
                data={"event_id": current_event, "project": -1},
                format="json",
            )

        assert response.status_code == 200, response.content

        assert len(response.data["transactions"]) == 2
        events = {item["event_id"]: item for item in response.data["transactions"]}

        assert current_event in events
        event = events[current_event]
        # Parent/generation is unknown in this case
        assert event["generation"] is None
        assert event["parent_event_id"] is None
        # But we still know the parent_span
        assert event["parent_span_id"] == self.gen1_span_ids[0]

        assert child_event_id in events
        event = events[child_event_id]
        assert event["generation"] is None
        assert event["parent_event_id"] == current_event
        assert event["parent_span_id"] == self.gen2_span_id

    def test_third_generation_no_children(self):
        self.load_trace()
        current_event = self.gen3_event.event_id

        with self.feature(self.FEATURES):
            response = self.client.get(
                self.url,
                data={"event_id": current_event, "project": -1},
                format="json",
            )

        assert response.status_code == 200, response.content

        assert len(response.data["transactions"]) == 1

        event = response.data["transactions"][0]
        assert event["generation"] is None
        # Parent is unknown in this case
        assert event["parent_event_id"] is None
        # But we still know the parent_span
        assert event["parent_span_id"] == self.gen2_span_id

    def test_sibling_transactions(self):
        """More than one transaction can share a parent_span_id"""
        self.load_trace()
        gen3_event_siblings = [
            self.create_event(
                trace=self.trace_id,
                transaction="/transaction/gen3-1",
                spans=[],
                project_id=self.create_project(organization=self.organization).id,
                parent_span_id=self.gen2_span_ids[1],
                duration=500,
            ).event_id,
            self.create_event(
                trace=self.trace_id,
                transaction="/transaction/gen3-2",
                spans=[],
                project_id=self.create_project(organization=self.organization).id,
                parent_span_id=self.gen2_span_ids[1],
                duration=525,
            ).event_id,
        ]

        current_event = self.gen2_events[1].event_id

        with self.feature(self.FEATURES):
            response = self.client.get(
                self.url,
                data={"event_id": current_event, "project": -1},
                format="json",
            )

        assert len(response.data["transactions"]) == 3
        events = {item["event_id"]: item for item in response.data["transactions"]}

        for child_event_id in gen3_event_siblings:
            assert child_event_id in events
            event = events[child_event_id]
            assert event["generation"] is None
            assert event["parent_event_id"] == current_event
            assert event["parent_span_id"] == self.gen2_span_ids[1]

    def test_with_error_event(self):
        self.load_trace()
        root_event_id = self.root_event.event_id
        current_transaction_event = self.gen1_events[0].event_id

        start, _ = self.get_start_end(1000)
        error_data = load_data(
            "javascript",
            timestamp=start,
        )
        error_data["contexts"]["trace"] = {
            "type": "trace",
            "trace_id": self.trace_id,
            "span_id": self.gen1_span_ids[0],
        }
        error_data["tags"] = [["transaction", "/transaction/gen1-0"]]
        error = self.store_event(error_data, project_id=self.gen1_project.id)

        def assertions(response):
            assert response.status_code == 200, response.content
            assert len(response.data["transactions"]) == 3
            events = {item["event_id"]: item for item in response.data["transactions"]}

            assert root_event_id in events
            event = events[root_event_id]
            assert event["generation"] == 0
            assert event["parent_event_id"] is None
            assert event["parent_span_id"] is None
            assert len(event["errors"]) == 0

            assert current_transaction_event in events
            event = events[current_transaction_event]
            assert event["generation"] == 1
            assert event["parent_event_id"] == root_event_id
            assert event["parent_span_id"] == self.root_span_ids[0]
            assert len(event["errors"]) == 1
            assert event["errors"][0]["event_id"] == error.event_id
            assert event["errors"][0]["issue_id"] == error.group_id

        with self.feature(self.FEATURES):
            response = self.client.get(
                self.url,
                data={"event_id": error.event_id, "project": -1},
                format="json",
            )

        assertions(response)

        with self.feature(self.FEATURES):
            response = self.client.get(
                self.url,
                data={"event_id": current_transaction_event, "project": -1},
                format="json",
            )

        assertions(response)

    def assert_orphan_error_response(self, response, error, span_id):
        assert response.status_code == 200, response.content
        assert response.data["transactions"] == []
        assert len(response.data["orphan_errors"]) == 1
        assert {
            "event_id": error.event_id,
            "issue_id": error.group_id,
            "span": span_id,
            "project_id": self.project.id,
            "project_slug": self.project.slug,
            "level": "fatal",
            "title": error.title,
            "timestamp": to_timestamp_from_iso_format(error.timestamp),
            "generation": 0,
            "event_type": "error",
        } == response.data["orphan_errors"][0]

    def test_with_one_orphan_error(self):
        self.load_trace()
        span_id = uuid4().hex[:16]
        start, _ = self.get_start_end(1000)

        error_data = load_data(
            "javascript",
            timestamp=start,
        )
        error_data["contexts"]["trace"] = {
            "type": "trace",
            "trace_id": self.trace_id,
            "span_id": span_id,
        }
        error_data["level"] = "fatal"
        error = self.store_event(error_data, project_id=self.project.id)

        with self.feature(
            [*self.FEATURES, "organizations:performance-tracing-without-performance"]
        ):
            response = self.client.get(
                self.url,
                data={"event_id": error.event_id, "project": -1},
                format="json",
            )

        self.assert_orphan_error_response(response, error, span_id)

    def test_with_multiple_orphan_errors(self):
        self.load_trace()
        span_id = uuid4().hex[:16]
        start, end = self.get_start_end(1000)

        error_data = load_data(
            "javascript",
            timestamp=start,
        )
        error_data["contexts"]["trace"] = {
            "type": "trace",
            "trace_id": self.trace_id,
            "span_id": span_id,
        }
        error_data["level"] = "fatal"
        error = self.store_event(error_data, project_id=self.project.id)

        error_data1 = load_data(
            "javascript",
            timestamp=end,
        )
        error_data1["contexts"]["trace"] = {
            "type": "trace",
            "trace_id": self.trace_id,
            "span_id": span_id,
        }
        error_data1["level"] = "warning"
        self.store_event(error_data1, project_id=self.project.id)

        with self.feature(
            [*self.FEATURES, "organizations:performance-tracing-without-performance"]
        ):
            response = self.client.get(
                self.url,
                data={"event_id": error.event_id, "project": -1},
                format="json",
            )

        self.assert_orphan_error_response(response, error, span_id)

    def test_with_unknown_event(self):
        with self.feature(
            [*self.FEATURES, "organizations:performance-tracing-without-performance"]
        ):
            response = self.client.get(
                self.url,
                data={"event_id": "766758c00ff54d8ab865369ecab53ae6", "project": "-1"},
                format="json",
            )

        assert response.status_code == 404


@region_silo_test
class OrganizationEventsTraceEndpointTest(OrganizationEventsTraceEndpointBase):
    url_name = "sentry-api-0-organization-events-trace"

    def assert_event(self, result, event_data, message):
        assert result["event_id"] == event_data.event_id, message
        assert result["timestamp"] == event_data.data["timestamp"], message
        assert result["start_timestamp"] == event_data.data["start_timestamp"], message

    def assert_trace_data(self, root, gen2_no_children=True):
        """see the setUp docstring for an idea of what the response structure looks like"""
        self.assert_event(root, self.root_event, "root")
        assert root["parent_event_id"] is None
        assert root["parent_span_id"] is None
        assert root["generation"] == 0
        assert root["transaction.duration"] == 3000
        assert len(root["children"]) == 3
        assert len(root["performance_issues"]) == 1
        assert root["performance_issues"][0]["suspect_spans"][0] == self.root_span_ids[0]

        for i, gen1 in enumerate(root["children"]):
            self.assert_event(gen1, self.gen1_events[i], f"gen1_{i}")
            assert gen1["parent_event_id"] == self.root_event.event_id
            assert gen1["parent_span_id"] == self.root_span_ids[i]
            assert gen1["generation"] == 1
            assert gen1["transaction.duration"] == 2000
            assert len(gen1["children"]) == 1

            gen2 = gen1["children"][0]
            self.assert_event(gen2, self.gen2_events[i], f"gen2_{i}")
            assert gen2["parent_event_id"] == self.gen1_events[i].event_id
            assert gen2["parent_span_id"] == self.gen1_span_ids[i]
            assert gen2["generation"] == 2
            assert gen2["transaction.duration"] == 1000

            # Only the first gen2 descendent has a child
            if i == 0:
                assert len(gen2["children"]) == 1
                gen3 = gen2["children"][0]
                self.assert_event(gen3, self.gen3_event, f"gen3_{i}")
                assert gen3["parent_event_id"] == self.gen2_events[i].event_id
                assert gen3["parent_span_id"] == self.gen2_span_id
                assert gen3["generation"] == 3
                assert gen3["transaction.duration"] == 500
                assert len(gen3["children"]) == 0
            elif gen2_no_children:
                assert len(gen2["children"]) == 0

    def test_no_projects(self):
        user = self.create_user()
        org = self.create_organization(owner=user)
        self.login_as(user=user)

        url = reverse(
            self.url_name,
            kwargs={"organization_slug": org.slug, "trace_id": uuid4().hex},
        )

        with self.feature(self.FEATURES):
            response = self.client.get(
                url,
                format="json",
            )

        assert response.status_code == 404, response.content

    def test_simple(self):
        self.load_trace()
        with self.feature(self.FEATURES):
            response = self.client.get(
                self.url,
                data={"project": -1},
                format="json",
            )
        assert response.status_code == 200, response.content
        trace_transaction = response.data["transactions"][0]
        self.assert_trace_data(trace_transaction)
        # We shouldn't have detailed fields here
        assert "transaction.status" not in trace_transaction
        assert "tags" not in trace_transaction
        assert "measurements" not in trace_transaction

    def test_simple_with_limit(self):
        self.load_trace()
        with self.feature(self.FEATURES):
            response = self.client.get(
                self.url,
                data={"project": -1, "limit": 200},
                format="json",
            )
        assert response.status_code == 200, response.content
        trace_transaction = response.data["transactions"][0]
        self.assert_trace_data(trace_transaction)
        # We shouldn't have detailed fields here
        assert "transaction.status" not in trace_transaction
        assert "tags" not in trace_transaction
        assert "measurements" not in trace_transaction

    def test_detailed_trace(self):
        self.load_trace()
        with self.feature(self.FEATURES):
            response = self.client.get(
                self.url,
                data={"project": -1, "detailed": 1},
                format="json",
            )
        assert response.status_code == 200, response.content
        trace_transaction = response.data["transactions"][0]
        self.assert_trace_data(trace_transaction)
        root = trace_transaction
        assert root["transaction.status"] == "ok"
        root_tags = {tag["key"]: tag["value"] for tag in root["tags"]}
        for [key, value] in self.root_event.tags:
            if not key.startswith("sentry:"):
                assert root_tags[key] == value, f"tags - {key}"
            else:
                assert root_tags[key[7:]] == value, f"tags - {key}"
        assert root["measurements"]["lcp"]["value"] == 1000
        assert root["measurements"]["fcp"]["value"] == 750
        assert "issue_short_id" in trace_transaction["performance_issues"][0]
        assert trace_transaction["performance_issues"][0]["culprit"] == "root"
        assert (
            trace_transaction["performance_issues"][0]["type"]
            == PerformanceFileIOMainThreadGroupType.type_id
        )

    def test_detailed_trace_with_bad_tags(self):
        """Basically test that we're actually using the event serializer's method for tags"""
        trace = uuid4().hex
        self.create_event(
            trace=trace,
            transaction="bad-tags",
            parent_span_id=None,
            spans=[],
            project_id=self.project.id,
            tags=[["somethinglong" * 250, "somethinglong" * 250]],
            duration=3000,
            assert_no_errors=False,
        )

        url = reverse(
            self.url_name,
            kwargs={"organization_slug": self.project.organization.slug, "trace_id": trace},
        )

        with self.feature(self.FEATURES):
            response = self.client.get(
                url,
                data={"project": -1, "detailed": 1},
                format="json",
            )

        assert response.status_code == 200, response.content
        root = response.data["transactions"][0]
        assert root["transaction.status"] == "ok"
        assert {"key": None, "value": None} in root["tags"]

    def test_bad_span_loop(self):
        """Maliciously create a loop in the span structure
        Structure then becomes something like this:
        root
            gen1-0...
            gen1-1
                gen2-1
                    gen3-1
                        gen_2-1
                            gen3-1...
        """
        self.load_trace()
        gen3_loop_event = self.create_event(
            trace=self.trace_id,
            transaction="/transaction/gen3-1/loop",
            spans=[
                {
                    "same_process_as_parent": True,
                    "op": "http",
                    "description": "GET gen2-1",
                    "span_id": self.gen1_span_ids[1],
                    "trace_id": self.trace_id,
                }
            ],
            parent_span_id=self.gen2_span_ids[1],
            project_id=self.project.id,
        )

        with self.feature(self.FEATURES):
            response = self.client.get(
                self.url,
                data={"project": -1},
                format="json",
            )

        assert response.status_code == 200, response.content
        # Should be the same as the simple testcase
        trace_transaction = response.data["transactions"][0]
        self.assert_trace_data(trace_transaction, gen2_no_children=False)
        # The difference is that gen3-1 should exist with no children
        gen2_1 = trace_transaction["children"][1]["children"][0]
        assert len(gen2_1["children"]) == 1
        gen3_1 = gen2_1["children"][0]
        assert gen3_1["event_id"] == gen3_loop_event.event_id
        # We didn't even try to start the loop of spans
        assert len(gen3_1["children"]) == 0

    def test_bad_orphan_span_loop(self):
        """Maliciously create a loop in the span structure but for an orphan event"""
        root_span_id = uuid4().hex[:16]
        root_parent_span = uuid4().hex[:16]
        root_event = self.create_event(
            trace=self.trace_id,
            transaction="/orphan/root/",
            spans=[
                {
                    "same_process_as_parent": True,
                    "op": "http",
                    "description": "GET orphan_child",
                    "span_id": root_span_id,
                    "trace_id": self.trace_id,
                }
            ],
            parent_span_id=root_parent_span,
            project_id=self.project.id,
            duration=3000,
        )
        orphan_child = self.create_event(
            trace=self.trace_id,
            transaction="/orphan/child/",
            spans=[
                {
                    "same_process_as_parent": True,
                    "op": "http",
                    "description": "GET orphan_root",
                    "span_id": root_parent_span,
                    "trace_id": self.trace_id,
                }
            ],
            parent_span_id=root_span_id,
            project_id=self.project.id,
            duration=300,
        )
        with self.feature(self.FEATURES):
            response = self.client.get(
                self.url,
                data={"project": -1},
                format="json",
            )

        assert response.status_code == 200, response.content

        assert len(response.data["transactions"]) == 1
        # There really isn't a right answer to which orphan is the "root" since this loops, but the current
        # implementation will make the older event the root
        root = response.data["transactions"][0]
        self.assert_event(root, root_event, "root")
        assert len(root["children"]) == 1
        child = root["children"][0]
        self.assert_event(child, orphan_child, "child")

    def test_multiple_roots(self):
        trace_id = uuid4().hex
        first_root = self.create_event(
            trace=trace_id,
            transaction="/first_root",
            spans=[],
            parent_span_id=None,
            project_id=self.project.id,
            duration=500,
        )
        second_root = self.create_event(
            trace=trace_id,
            transaction="/second_root",
            spans=[],
            parent_span_id=None,
            project_id=self.project.id,
            duration=1000,
        )
        self.url = reverse(
            self.url_name,
            kwargs={"organization_slug": self.project.organization.slug, "trace_id": trace_id},
        )
        with self.feature(self.FEATURES):
            response = self.client.get(
                self.url,
                data={"project": -1},
                format="json",
            )

        assert response.status_code == 200, response.content
        assert len(response.data["transactions"]) == 2
        self.assert_event(response.data["transactions"][0], first_root, "first_root")
        self.assert_event(response.data["transactions"][1], second_root, "second_root")

    def test_sibling_transactions(self):
        """More than one transaction can share a parent_span_id"""
        self.load_trace()
        gen3_event_siblings = [
            self.create_event(
                trace=self.trace_id,
                transaction="/transaction/gen3-1",
                spans=[],
                project_id=self.create_project(organization=self.organization).id,
                parent_span_id=self.gen2_span_ids[1],
                duration=500,
            ).event_id,
            self.create_event(
                trace=self.trace_id,
                transaction="/transaction/gen3-2",
                spans=[],
                project_id=self.create_project(organization=self.organization).id,
                parent_span_id=self.gen2_span_ids[1],
                duration=525,
            ).event_id,
        ]

        with self.feature(self.FEATURES):
            response = self.client.get(
                self.url,
                data={"project": -1},
                format="json",
            )

        assert response.status_code == 200, response.content
        # Should be the same as the simple testcase, but skip checking gen2 children
        self.assert_trace_data(response.data["transactions"][0], gen2_no_children=False)
        gen2_parent = response.data["transactions"][0]["children"][1]["children"][0]
        assert len(gen2_parent["children"]) == 2
        assert [child["event_id"] for child in gen2_parent["children"]] == gen3_event_siblings

    def test_with_orphan_siblings(self):
        self.load_trace()
        parent_span_id = uuid4().hex[:16]
        root_event = self.create_event(
            trace=self.trace_id,
            transaction="/orphan/root",
            spans=[],
            # Some random id so its separated from the rest of the trace
            parent_span_id=parent_span_id,
            project_id=self.project.id,
            # Shorter duration means that this event happened first, and should be ordered first
            duration=1000,
        )
        root_sibling_event = self.create_event(
            trace=self.trace_id,
            transaction="/orphan/root-sibling",
            spans=[],
            parent_span_id=parent_span_id,
            project_id=self.project.id,
            duration=1250,
        )

        with self.feature(self.FEATURES):
            response = self.client.get(
                self.url,
                data={"project": -1},
                format="json",
            )

        assert response.status_code == 200, response.content

        assert len(response.data["transactions"]) == 3
        # The first item of the response should be the main trace
        main, *orphans = response.data["transactions"]
        self.assert_trace_data(main)
        assert [root_event.event_id, root_sibling_event.event_id] == [
            orphan["event_id"] for orphan in orphans
        ]

    def test_with_orphan_trace(self):
        self.load_trace()
        orphan_span_ids = {
            key: uuid4().hex[:16]
            for key in ["root", "root_span", "child", "child_span", "grandchild", "grandchild_span"]
        }
        # Create the orphan transactions
        root_event = self.create_event(
            trace=self.trace_id,
            transaction="/orphan/root",
            spans=[
                {
                    "same_process_as_parent": True,
                    "op": "http",
                    "description": "GET gen1 orphan",
                    "span_id": orphan_span_ids["root_span"],
                    "trace_id": self.trace_id,
                }
            ],
            # Some random id so its separated from the rest of the trace
            parent_span_id=uuid4().hex[:16],
            span_id=orphan_span_ids["root"],
            project_id=self.project.id,
            duration=1000,
        )
        child_event = self.create_event(
            trace=self.trace_id,
            transaction="/orphan/child1-0",
            spans=[
                {
                    "same_process_as_parent": True,
                    "op": "http",
                    "description": "GET gen1 orphan",
                    "span_id": orphan_span_ids["child_span"],
                    "trace_id": self.trace_id,
                }
            ],
            parent_span_id=orphan_span_ids["root_span"],
            span_id=orphan_span_ids["child"],
            project_id=self.gen1_project.id,
            # Because the snuba query orders based is_root then timestamp, this causes grandchild1-0 to be added to
            # results first before child1-0
            duration=2500,
        )
        grandchild_event = self.create_event(
            trace=self.trace_id,
            transaction="/orphan/grandchild1-0",
            spans=[
                {
                    "same_process_as_parent": True,
                    "op": "http",
                    "description": "GET gen1 orphan",
                    "span_id": orphan_span_ids["grandchild_span"],
                    "trace_id": self.trace_id,
                }
            ],
            parent_span_id=orphan_span_ids["child_span"],
            span_id=orphan_span_ids["grandchild"],
            project_id=self.gen1_project.id,
            duration=1500,
        )

        with self.feature(self.FEATURES):
            response = self.client.get(
                self.url,
                data={"project": -1},
                format="json",
            )

        assert response.status_code == 200, response.content
        assert len(response.data["transactions"]) == 2
        # The first item of the response should be the main trace
        main, orphans = response.data["transactions"]
        self.assert_trace_data(main)
        self.assert_event(orphans, root_event, "orphan-root")
        assert len(orphans["children"]) == 1
        assert orphans["generation"] == 0
        assert orphans["parent_event_id"] is None
        child = orphans["children"][0]
        self.assert_event(child, child_event, "orphan-child")
        assert len(child["children"]) == 1
        assert child["generation"] == 1
        assert child["parent_event_id"] == root_event.event_id
        grandchild = child["children"][0]
        self.assert_event(grandchild, grandchild_event, "orphan-grandchild")
        assert grandchild["generation"] == 2
        assert grandchild["parent_event_id"] == child_event.event_id

    def test_with_errors(self):
        self.load_trace()
        error, error1 = self.load_errors()

        with self.feature(self.FEATURES):
            response = self.client.get(
                self.url,
                data={"project": -1},
                format="json",
            )

        assert response.status_code == 200, response.content
        self.assert_trace_data(response.data["transactions"][0])
        gen1_event = response.data["transactions"][0]["children"][0]
        assert len(gen1_event["errors"]) == 2
        assert {
            "event_id": error.event_id,
            "issue_id": error.group_id,
            "span": self.gen1_span_ids[0],
            "project_id": self.gen1_project.id,
            "project_slug": self.gen1_project.slug,
            "level": "fatal",
            "title": error.title,
            "timestamp": to_timestamp_from_iso_format(error.timestamp),
            "generation": 0,
            "event_type": "error",
        } in gen1_event["errors"]
        assert {
            "event_id": error1.event_id,
            "issue_id": error1.group_id,
            "span": self.gen1_span_ids[0],
            "project_id": self.gen1_project.id,
            "project_slug": self.gen1_project.slug,
            "level": "warning",
            "title": error1.title,
            "timestamp": to_timestamp_from_iso_format(error1.timestamp),
            "generation": 0,
            "event_type": "error",
        } in gen1_event["errors"]

    def test_with_only_orphan_errors_with_same_span_ids(self):
        span_id = uuid4().hex[:16]
        start, end = self.get_start_end(10000)

        # Error 1
        error_data = load_data(
            "javascript",
            timestamp=end,
        )
        error_data["contexts"]["trace"] = {
            "type": "trace",
            "trace_id": self.trace_id,
            "span_id": span_id,
        }
        error_data["level"] = "fatal"
        error = self.store_event(error_data, project_id=self.project.id)

        # Error 2 before after Error 1
        error_data1 = load_data(
            "javascript",
            timestamp=start,
        )
        error_data1["level"] = "warning"
        error_data1["contexts"]["trace"] = {
            "type": "trace",
            "trace_id": self.trace_id,
            "span_id": span_id,
        }
        error1 = self.store_event(error_data1, project_id=self.project.id)

        with self.feature(
            [*self.FEATURES, "organizations:performance-tracing-without-performance"]
        ):
            response = self.client.get(
                self.url,
                data={"project": -1},
                format="json",
            )
        assert response.status_code == 200, response.content
        assert len(response.data) == 2
        # Sorting by timestamp puts Error1 after Error2 in the response
        assert {
            "event_id": error.event_id,
            "issue_id": error.group_id,
            "span": span_id,
            "project_id": self.project.id,
            "project_slug": self.project.slug,
            "level": "fatal",
            "title": error.title,
            "timestamp": to_timestamp_from_iso_format(error.timestamp),
            "generation": 0,
            "event_type": "error",
        } == response.data["orphan_errors"][1]
        assert {
            "event_id": error1.event_id,
            "issue_id": error1.group_id,
            "span": span_id,
            "project_id": self.project.id,
            "project_slug": self.project.slug,
            "level": "warning",
            "title": error1.title,
            "timestamp": to_timestamp_from_iso_format(error1.timestamp),
            "generation": 0,
            "event_type": "error",
        } == response.data["orphan_errors"][0]

    def test_with_only_orphan_errors_with_different_span_ids(self):
        start, _ = self.get_start_end(1000)
        span_id = uuid4().hex[:16]
        error_data = load_data(
            "javascript",
            timestamp=start,
        )
        error_data["contexts"]["trace"] = {
            "type": "trace",
            "trace_id": self.trace_id,
            "span_id": span_id,
        }
        error_data["level"] = "fatal"
        error = self.store_event(error_data, project_id=self.project.id)
        error_data["level"] = "warning"
        span_id1 = uuid4().hex[:16]
        error_data["contexts"]["trace"] = {
            "type": "trace",
            "trace_id": self.trace_id,
            "span_id": span_id1,
        }
        error1 = self.store_event(error_data, project_id=self.project.id)

        with self.feature(
            [*self.FEATURES, "organizations:performance-tracing-without-performance"]
        ):
            response = self.client.get(
                self.url,
                data={"project": -1},
                format="json",
            )
        assert response.status_code == 200, response.content
        assert len(response.data["orphan_errors"]) == 2
        assert {
            "event_id": error.event_id,
            "issue_id": error.group_id,
            "span": span_id,
            "project_id": self.project.id,
            "project_slug": self.project.slug,
            "level": "fatal",
            "title": error.title,
            "timestamp": to_timestamp_from_iso_format(error.timestamp),
            "generation": 0,
            "event_type": "error",
        } in response.data["orphan_errors"]
        assert {
            "event_id": error1.event_id,
            "issue_id": error1.group_id,
            "span": span_id1,
            "project_id": self.project.id,
            "project_slug": self.project.slug,
            "level": "warning",
            "title": error1.title,
            "timestamp": to_timestamp_from_iso_format(error1.timestamp),
            "generation": 0,
            "event_type": "error",
        } in response.data["orphan_errors"]

    def test_with_mixup_of_orphan_errors_with_simple_trace_data(self):
        self.load_trace()
        start, _ = self.get_start_end(1000)
        span_id = uuid4().hex[:16]
        error_data = load_data(
            "javascript",
            timestamp=start,
        )
        error_data["contexts"]["trace"] = {
            "type": "trace",
            "trace_id": self.trace_id,
            "span_id": span_id,
        }
        error_data["level"] = "fatal"
        error = self.store_event(error_data, project_id=self.project.id)
        error_data["level"] = "warning"
        span_id1 = uuid4().hex[:16]
        error_data["contexts"]["trace"] = {
            "type": "trace",
            "trace_id": self.trace_id,
            "span_id": span_id1,
        }

        with self.feature(
            [*self.FEATURES, "organizations:performance-tracing-without-performance"]
        ):
            response = self.client.get(
                self.url,
                data={"project": -1},
                format="json",
            )
        assert response.status_code == 200, response.content
        assert len(response.data["transactions"]) == 1
        assert len(response.data["orphan_errors"]) == 1
        self.assert_trace_data(response.data["transactions"][0])
        assert {
            "event_id": error.event_id,
            "issue_id": error.group_id,
            "span": span_id,
            "project_id": self.project.id,
            "project_slug": self.project.slug,
            "level": "fatal",
            "title": error.title,
            "timestamp": to_timestamp_from_iso_format(error.timestamp),
            "generation": 0,
            "event_type": "error",
        } in response.data["orphan_errors"]

    def test_with_default(self):
        self.load_trace()
        start, _ = self.get_start_end(1000)
        default_event = self.load_default()
        with self.feature(self.FEATURES):
            response = self.client.get(
                self.url,
                data={"project": -1},
                format="json",
            )

        assert response.status_code == 200, response.content
        self.assert_trace_data(response.data["transactions"][0])
        root_event = response.data["transactions"][0]
        assert len(root_event["errors"]) == 1
        assert {
            "event_id": default_event.event_id,
            "issue_id": default_event.group_id,
            "span": self.root_span_ids[0],
            "project_id": self.gen1_project.id,
            "project_slug": self.gen1_project.slug,
            "level": "debug",
            "title": "this is a log message",
            "timestamp": to_timestamp_from_iso_format(default_event.timestamp),
            "generation": 0,
            "event_type": "error",
        } in root_event["errors"]

    def test_pruning_root(self):
        self.load_trace()
        # Pruning shouldn't happen for the root event
        with self.feature(self.FEATURES):
            response = self.client.get(
                self.url,
                data={"project": -1, "event_id": self.root_event.event_id},
                format="json",
            )
        assert response.status_code == 200, response.content
        self.assert_trace_data(response.data["transactions"][0])

    def test_pruning_event(self):
        self.load_trace()
        with self.feature(self.FEATURES):
            response = self.client.get(
                self.url,
                data={"project": -1, "event_id": self.gen2_events[0].event_id},
                format="json",
            )
        assert response.status_code == 200, response.content
        root = response.data["transactions"][0]

        self.assert_event(root, self.root_event, "root")

        # Because of snuba query orders by timestamp we should still have all of the root's children
        assert len(root["children"]) == 3
        for i, gen1 in enumerate(root["children"]):
            self.assert_event(gen1, self.gen1_events[i], f"gen1_{i}")
            if i == 0:
                assert len(gen1["children"]) == 1

                gen2 = gen1["children"][0]
                self.assert_event(gen2, self.gen2_events[0], "gen2_0")
                assert len(gen2["children"]) == 1
                gen3 = gen2["children"][0]
                self.assert_event(gen3, self.gen3_event, "gen3_0")
            else:
                assert len(gen1["children"]) == 0


@region_silo_test
class OrganizationEventsTraceMetaEndpointTest(OrganizationEventsTraceEndpointBase):
    url_name = "sentry-api-0-organization-events-trace-meta"

    def test_no_projects(self):
        user = self.create_user()
        org = self.create_organization(owner=user)
        self.login_as(user=user)

        url = reverse(
            self.url_name,
            kwargs={"organization_slug": org.slug, "trace_id": uuid4().hex},
        )

        with self.feature(self.FEATURES):
            response = self.client.get(
                url,
                format="json",
            )

        assert response.status_code == 404, response.content

    def test_bad_ids(self):
        # Fake trace id
        self.url = reverse(
            self.url_name,
            kwargs={"organization_slug": self.project.organization.slug, "trace_id": uuid4().hex},
        )

        with self.feature(self.FEATURES):
            response = self.client.get(
                self.url,
                format="json",
            )

        assert response.status_code == 200, response.content
        data = response.data
        assert data["projects"] == 0
        assert data["transactions"] == 0
        assert data["errors"] == 0
        assert data["performance_issues"] == 0

        # Invalid trace id
        with pytest.raises(NoReverseMatch):
            self.url = reverse(
                self.url_name,
                kwargs={
                    "organization_slug": self.project.organization.slug,
                    "trace_id": "not-a-trace",
                },
            )

    def test_simple(self):
        self.load_trace()
        with self.feature(self.FEATURES):
            response = self.client.get(
                self.url,
                data={"project": -1},
                format="json",
            )
        assert response.status_code == 200, response.content
        data = response.data
        assert data["projects"] == 4
        assert data["transactions"] == 8
        assert data["errors"] == 0
        assert data["performance_issues"] == 1

    def test_with_errors(self):
        self.load_trace()
        self.load_errors()
        with self.feature(self.FEATURES):
            response = self.client.get(
                self.url,
                data={"project": -1},
                format="json",
            )
        assert response.status_code == 200, response.content
        data = response.data
        assert data["projects"] == 4
        assert data["transactions"] == 8
        assert data["errors"] == 2
        assert data["performance_issues"] == 1

    def test_with_default(self):
        self.load_trace()
        self.load_default()
        with self.feature(self.FEATURES):
            response = self.client.get(
                self.url,
                data={"project": -1},
                format="json",
            )
        assert response.status_code == 200, response.content
        data = response.data
        assert data["projects"] == 4
        assert data["transactions"] == 8
        assert data["errors"] == 1
        assert data["performance_issues"] == 1
