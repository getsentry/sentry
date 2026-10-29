from uuid import uuid4

from django.urls import reverse

from sentry import options
from sentry.testutils.cases import TraceTestCase
from tests.snuba.api.endpoints.test_organization_events import OrganizationEventsEndpointTestBase


class OrganizationEventsTraceEndpointBase(OrganizationEventsEndpointTestBase, TraceTestCase):
    url_name: str
    FEATURES = [
        "organizations:performance-view",
    ]

    def setUp(self) -> None:
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
        options.set("performance.issues.slow_db_query.problem-creation", 1.0)
        self.login_as(user=self.user)

        self.url = reverse(
            self.url_name,
            kwargs={
                "organization_id_or_slug": self.project.organization.slug,
                "trace_id": self.trace_id,
            },
        )

    def load_trace(self):
        self.root_event = self.create_event(
            trace_id=self.trace_id,
            transaction="root",
            spans=[
                {
                    "same_process_as_parent": True,
                    "op": "http",
                    "description": f"GET gen1-{i}",
                    "span_id": root_span_id,
                    "trace_id": self.trace_id,
                    "data": {
                        "gen_ai.request.model": "gpt-4o",
                        "gen_ai.usage.total_tokens": 100,
                        "browser.web_vital.lcp.value": 2807.335,
                        "browser.web_vital.cls.value": 0.0382,
                        "browser.web_vital.inp.value": 120.0,
                        "browser.web_vital.ttfb.value": 450.0,
                        "browser.web_vital.fcp.value": 2258.06,
                        "app.vitals.start.cold.value": 1600.0,
                        "app.vitals.start.warm.value": 400.0,
                        "app.vitals.ttid.value": 1200.0,
                        "app.vitals.ttfd.value": 2400.0,
                    },
                }
                for i, root_span_id in enumerate(self.root_span_ids)
            ],
            measurements={
                "lcp": 1000,
                "fcp": 750,
                "fid": 3.5,
            },
            parent_span_id=None,
            file_io_performance_issue=True,
            slow_db_performance_issue=True,
            project_id=self.project.id,
            milliseconds=3000,
        )

        # First Generation
        self.gen1_span_ids = [uuid4().hex[:16] for _ in range(3)]
        self.gen1_project = self.create_project(organization=self.organization)
        self.gen1_events = [
            self.create_event(
                trace_id=self.trace_id,
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
                milliseconds=2000,
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
                trace_id=self.trace_id,
                transaction=f"/transaction/gen2-{i}",
                spans=[
                    {
                        "same_process_as_parent": True,
                        "op": "http",
                        "description": f"GET gen3-{i}" if i == 0 else f"SPAN gen3-{i}",
                        "span_id": gen2_span_id,
                        "trace_id": self.trace_id,
                        "parent_span_id": self.gen2_span_id,
                    }
                ],
                parent_span_id=gen1_span_id,
                span_id=self.gen2_span_id if i == 0 else None,
                project_id=self.gen2_project.id,
                milliseconds=1000,
            )
            for i, (gen1_span_id, gen2_span_id) in enumerate(
                zip(self.gen1_span_ids, self.gen2_span_ids)
            )
        ]

        # Third generation
        self.gen3_project = self.create_project(organization=self.organization)
        self.gen3_event = self.create_event(
            trace_id=self.trace_id,
            transaction="/transaction/gen3-0",
            spans=[],
            project_id=self.gen3_project.id,
            parent_span_id=self.gen2_span_id,
            milliseconds=500,
        )
