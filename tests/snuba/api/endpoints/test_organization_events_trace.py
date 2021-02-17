from uuid import uuid4

from django.core.urlresolvers import reverse

from sentry.utils.samples import load_data
from sentry.testutils import APITestCase, SnubaTestCase
from sentry.testutils.helpers.datetime import before_now


class OrganizationEventsTrendsLightEndpointTest(APITestCase, SnubaTestCase):
    FEATURES = ["organizations:trace-view-quick", "organizations:global-views"]

    def create_event(self, trace, transaction, spans, parent_span_id, project_id):
        data = load_data(
            "transaction",
            trace=trace,
            spans=spans,
            timestamp=before_now(minutes=1),
            start_timestamp=before_now(minutes=5),
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
        root_span_ids = [uuid4().hex[:16] for _ in range(3)]
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
                for i, root_span_id in enumerate(root_span_ids)
            ],
            parent_span_id=None,
            project_id=self.project.id,
        )

        # First Generation
        gen1_span_ids = [uuid4().hex[:16] for _ in range(3)]
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
                project_id=self.create_project(organization=self.organization).id,
            )
            for i, (root_span_id, gen1_span_id) in enumerate(zip(root_span_ids, gen1_span_ids))
        ]

        # Second Generation
        gen2_span_ids = [uuid4().hex[:16] for _ in range(3)]
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
                project_id=self.create_project(organization=self.organization).id,
            )
            for i, (gen1_span_id, gen2_span_id) in enumerate(zip(gen1_span_ids, gen2_span_ids))
        ]

        # Third generation
        self.gen3_event = self.create_event(
            trace=self.trace_id,
            transaction="/transaction/gen3-0",
            spans=[],
            parent_span_id=gen2_span_ids[0],
            project_id=self.create_project(organization=self.organization).id,
        )

        self.url = reverse(
            "sentry-api-0-organization-events-trace-light",
            kwargs={"organization_slug": self.project.organization.slug, "trace_id": self.trace_id},
        )

    def test_no_projects(self):
        user = self.create_user()
        org = self.create_organization(owner=user)
        self.login_as(user=user)

        url = reverse(
            "sentry-api-0-organization-events-trace-light",
            kwargs={"organization_slug": org.slug, "trace_id": uuid4().hex},
        )

        with self.feature(self.FEATURES):
            response = self.client.get(
                url,
                format="json",
            )

        assert response.status_code == 200, response.content
        assert len(response.data) == 0

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
        assert event["is_root"]
        assert event["parent_event_id"] is None

        for child_event in self.gen1_events:
            child_event_id = child_event.event_id
            assert child_event_id in events
            event = events[child_event_id]
            assert not event["is_root"]
            assert event["parent_event_id"] == root_event_id

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
        assert event["is_root"]
        assert event["parent_event_id"] is None

        assert current_event in events
        event = events[current_event]
        assert not event["is_root"]
        assert event["parent_event_id"] == root_event_id

        assert child_event_id in events
        event = events[child_event_id]
        assert not event["is_root"]
        assert event["parent_event_id"] == current_event

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
        assert event["is_root"]
        assert event["parent_event_id"] is None

        assert current_event in events
        event = events[current_event]
        assert not event["is_root"]
        # Parent is unknown in this case
        assert event["parent_event_id"] is None

        assert child_event_id in events
        event = events[child_event_id]
        assert not event["is_root"]
        assert event["parent_event_id"] == current_event

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
        assert event["is_root"]
        assert event["parent_event_id"] is None

        assert current_event in events
        event = events[current_event]
        assert not event["is_root"]
        # Parent is unknown in this case
        assert event["parent_event_id"] is None
