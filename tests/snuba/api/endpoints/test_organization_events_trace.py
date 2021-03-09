from uuid import uuid4
from datetime import timedelta

from django.core.urlresolvers import reverse

from sentry.utils.samples import load_data
from sentry.testutils import APITestCase, SnubaTestCase
from sentry.testutils.helpers.datetime import before_now, iso_format


class OrganizationEventsTraceEndpointBase(APITestCase, SnubaTestCase):
    FEATURES = [
        "organizations:trace-view-quick",
        "organizations:trace-view-summary",
        "organizations:global-views",
    ]

    def get_start_end(self, duration):
        start = before_now(minutes=1, milliseconds=duration)
        return start, start + timedelta(milliseconds=duration)

    def create_event(self, trace, transaction, spans, parent_span_id, project_id, duration=4000):
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
        return self.store_event(data, project_id=project_id)

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
        self.login_as(user=self.user)

        self.day_ago = before_now(days=1).replace(hour=10, minute=0, second=0, microsecond=0)
        self.root_span_ids = [uuid4().hex[:16] for _ in range(3)]
        self.trace_id = uuid4().hex
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
            parent_span_id=None,
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
            parent_span_id=self.gen2_span_ids[0],
            duration=500,
        )

        self.url = reverse(
            self.url_name,
            kwargs={"organization_slug": self.project.organization.slug, "trace_id": self.trace_id},
        )


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

        # Fake trace id
        self.url = reverse(
            "sentry-api-0-organization-events-trace-light",
            kwargs={"organization_slug": self.project.organization.slug, "trace_id": uuid4().hex},
        )

        with self.feature(self.FEATURES):
            response = self.client.get(
                self.url,
                data={"event_id": self.root_event.event_id},
                format="json",
            )

        assert response.status_code == 404, response.content

    def test_no_roots(self):
        no_root_trace = uuid4().hex
        event = self.create_event(
            trace=no_root_trace,
            transaction="/not_root/but_only_transaction",
            spans=[],
            parent_span_id=uuid4().hex[:16],
            project_id=self.project.id,
        )
        self.url = reverse(
            "sentry-api-0-organization-events-trace-light",
            kwargs={"organization_slug": self.project.organization.slug, "trace_id": no_root_trace},
        )

        with self.feature(self.FEATURES):
            response = self.client.get(
                self.url,
                data={"event_id": event.event_id},
                format="json",
            )

        assert response.status_code == 204, response.content

    def test_multiple_roots(self):
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

    def test_root_event(self):
        root_event_id = self.root_event.event_id

        with self.feature(self.FEATURES):
            response = self.client.get(
                self.url,
                data={"event_id": root_event_id, "project": -1},
                format="json",
            )

        assert response.status_code == 200, response.content

        assert len(response.data) == 4
        events = {item["event_id"]: item for item in response.data}

        assert root_event_id in events
        event = events[root_event_id]
        assert event["generation"] == 0
        assert event["parent_event_id"] is None
        assert event["parent_span_id"] is None

        for i, child_event in enumerate(self.gen1_events):
            child_event_id = child_event.event_id
            assert child_event_id in events
            event = events[child_event_id]
            assert event["generation"] is None
            assert event["parent_event_id"] == root_event_id
            assert event["parent_span_id"] == self.root_span_ids[i]

    def test_direct_parent_with_children(self):
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

        assert len(response.data) == 3
        events = {item["event_id"]: item for item in response.data}

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
        assert event["generation"] is None
        assert event["parent_event_id"] == current_event
        assert event["parent_span_id"] == self.gen1_span_ids[0]

    def test_second_generation_with_children(self):
        root_event_id = self.root_event.event_id
        current_event = self.gen2_events[0].event_id
        child_event_id = self.gen3_event.event_id

        with self.feature(self.FEATURES):
            response = self.client.get(
                self.url,
                data={"event_id": current_event, "project": -1},
                format="json",
            )

        assert response.status_code == 200, response.content

        assert len(response.data) == 3
        events = {item["event_id"]: item for item in response.data}

        assert root_event_id in events
        event = events[root_event_id]
        assert event["generation"] == 0
        assert event["parent_event_id"] is None
        assert event["parent_span_id"] is None

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
        assert event["parent_span_id"] == self.gen2_span_ids[0]

    def test_third_generation_no_children(self):
        root_event_id = self.root_event.event_id
        current_event = self.gen3_event.event_id

        with self.feature(self.FEATURES):
            response = self.client.get(
                self.url,
                data={"event_id": current_event, "project": -1},
                format="json",
            )

        assert response.status_code == 200, response.content

        assert len(response.data) == 2
        events = {item["event_id"]: item for item in response.data}

        assert root_event_id in events
        event = events[root_event_id]
        assert event["generation"] == 0
        assert event["parent_event_id"] is None
        assert event["parent_span_id"] is None

        assert current_event in events
        event = events[current_event]
        assert event["generation"] is None
        # Parent is unknown in this case
        assert event["parent_event_id"] is None
        # But we still know the parent_span
        assert event["parent_span_id"] == self.gen2_span_ids[0]

    def test_sibling_transactions(self):
        """ More than one transaction can share a parent_span_id """
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
                duration=500,
            ).event_id,
        ]

        current_event = self.gen2_events[1].event_id

        with self.feature(self.FEATURES):
            response = self.client.get(
                self.url,
                data={"event_id": current_event, "project": -1},
                format="json",
            )

        assert len(response.data) == 4
        events = {item["event_id"]: item for item in response.data}

        for child_event_id in gen3_event_siblings:
            assert child_event_id in events
            event = events[child_event_id]
            assert event["generation"] is None
            assert event["parent_event_id"] == current_event
            assert event["parent_span_id"] == self.gen2_span_ids[1]


class OrganizationEventsTraceEndpointTest(OrganizationEventsTraceEndpointBase):
    url_name = "sentry-api-0-organization-events-trace"

    def assert_event(self, result, event_data, message):
        assert result["event_id"] == event_data.event_id, message
        assert result["timestamp"] == event_data.data["timestamp"], message
        assert result["start_timestamp"] == event_data.data["start_timestamp"], message

    def assert_trace_data(self, root, gen2_no_children=True):
        """ see the setUp docstring for an idea of what the response structure looks like """
        self.assert_event(root, self.root_event, "root")
        assert root["parent_event_id"] is None
        assert root["parent_span_id"] is None
        assert root["generation"] == 0
        assert root["transaction.duration"] == 3000
        assert len(root["children"]) == 3

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
                assert gen3["parent_span_id"] == self.gen2_span_ids[i]
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
        with self.feature(self.FEATURES):
            response = self.client.get(
                self.url,
                data={"project": -1},
                format="json",
            )
        assert response.status_code == 200, response.content
        self.assert_trace_data(response.data)

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
        self.assert_trace_data(response.data, gen2_no_children=False)
        # The difference is that gen3-1 should exist with no children
        gen2_1 = response.data["children"][1]["children"][0]
        assert len(gen2_1["children"]) == 1
        gen3_1 = gen2_1["children"][0]
        assert gen3_1["event_id"] == gen3_loop_event.event_id
        # We didn't even try to start the loop of spans
        assert len(gen3_1["children"]) == 0

    def test_sibling_transactions(self):
        """ More than one transaction can share a parent_span_id """
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
                duration=500,
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
        self.assert_trace_data(response.data, gen2_no_children=False)
        gen2_parent = response.data["children"][1]["children"][0]
        assert len(gen2_parent["children"]) == 2
        for child in gen2_parent["children"]:
            assert child["event_id"] in gen3_event_siblings

    def test_with_errors(self):
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
        error = self.store_event(error_data, project_id=self.gen1_project.id)
        error1 = self.store_event(error_data, project_id=self.gen1_project.id)

        with self.feature(self.FEATURES):
            response = self.client.get(
                self.url,
                data={"project": -1},
                format="json",
            )

        assert response.status_code == 200, response.content
        self.assert_trace_data(response.data)
        gen1_event = response.data["children"][0]
        assert len(gen1_event["errors"] == 2)
        assert {"id": error.event_id, "issue": error.group.qualified_short_id} in gen1_event[
            "errors"
        ]
        assert {"id": error1.event_id, "issue": error1.group.qualified_short_id} in gen1_event[
            "errors"
        ]

    def test_with_default(self):
        start, _ = self.get_start_end(1000)
        default_event = self.store_event(
            {
                "timestamp": iso_format(start),
                "contexts": {
                    "trace": {
                        "type": "trace",
                        "trace_id": self.trace_id,
                        "span_id": self.root_span_ids[0],
                    },
                },
            },
            project_id=self.gen1_project.id,
        )
        with self.feature(self.FEATURES):
            response = self.client.get(
                self.url,
                data={"project": -1},
                format="json",
            )

        assert response.status_code == 200, response.content
        self.assert_trace_data(response.data)
        root_event = response.data
        assert len(root_event["errors"]) == 1
        assert {
            "id": default_event.event_id,
            "issue": default_event.group.qualified_short_id,
        } in root_event["errors"]
