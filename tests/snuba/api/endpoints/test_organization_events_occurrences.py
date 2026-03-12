import uuid
from datetime import timedelta

from sentry.search.eap.occurrences.rollout_utils import EAPOccurrencesComparator
from sentry.testutils.cases import OccurrenceTestCase
from sentry.testutils.helpers.datetime import before_now
from tests.snuba.api.endpoints.test_organization_events import (
    OrganizationEventsEndpointTestBase,
)


class OrganizationEventsOccurrencesDatasetEndpointTest(
    OrganizationEventsEndpointTestBase, OccurrenceTestCase
):
    callsite_name = "api.events.endpoints"

    def setUp(self) -> None:
        super().setUp()

    def test_simple(self) -> None:
        event_id = uuid.uuid4().hex
        trace_id = uuid.uuid4().hex
        group = self.create_group(project=self.project)
        occ = self.create_eap_occurrence(
            event_id=event_id,
            group_id=group.id,
            trace_id=trace_id,
            attributes={
                "fingerprint": ["group1"],
            },
            project=self.project,
        )
        self.store_eap_items([occ])

        with self.options(
            {EAPOccurrencesComparator._callsite_allowlist_option_name(): self.callsite_name}
        ):
            response = self.do_request(
                {
                    "field": ["id", "group_id", "trace"],
                    "project": [self.project.id],
                    "dataset": "occurrences",
                }
            )
        assert response.status_code == 200
        assert len(response.data["data"]) == 1
        row = response.data["data"][0]
        assert row["id"] == event_id
        assert row["trace"] == trace_id
        assert row["group_id"] == group.id

    def test_group_id(self) -> None:
        event_id = uuid.uuid4().hex
        trace_id = uuid.uuid4().hex
        group = self.create_group(project=self.project)
        occ = self.create_eap_occurrence(
            event_id=event_id,
            group_id=group.id,
            trace_id=trace_id,
            attributes={
                "fingerprint": ["group1"],
            },
            project=self.project,
        )
        self.store_eap_items([occ])

        with self.options(
            {EAPOccurrencesComparator._callsite_allowlist_option_name(): self.callsite_name}
        ):
            response = self.do_request(
                {
                    "field": ["count()"],
                    "statsPeriod": "1h",
                    "query": f"project:{group.project.slug} group_id:{group.id}",
                    "dataset": "occurrences",
                }
            )
        assert response.status_code == 200, response.content
        assert response.data["data"][0]["count()"] == 1

    def _request_table_rate(self, field: str):
        """Store two occurrences in a 2h window and request /events/ with the given rate field."""
        group = self.create_group(project=self.project)
        occurrences = [
            self.create_eap_occurrence(
                group_id=group.id,
                project=self.project,
                attributes={"fingerprint": ["g1"]},
            ),
            self.create_eap_occurrence(
                group_id=group.id,
                project=self.project,
                attributes={"fingerprint": ["g1"]},
            ),
        ]
        self.store_eap_items(occurrences)
        with self.options(
            {EAPOccurrencesComparator._callsite_allowlist_option_name(): self.callsite_name}
        ):
            return self.do_request(
                {
                    "field": [field],
                    "statsPeriod": "2h",
                    "project": [self.project.id],
                    "dataset": "occurrences",
                }
            )

    def test_eps_rate_aggregate(self) -> None:
        # 2 events / 7200 seconds (2h).
        response = self._request_table_rate("eps()")
        assert response.status_code == 200, response.content
        data = response.data["data"]
        assert len(data) == 1
        assert abs(data[0]["eps()"] - (2 / 7200)) < 0.0001
        meta = response.data["meta"]
        assert meta["fields"]["eps()"] == "rate"
        assert meta["units"]["eps()"] == "1/second"

    def test_epm_rate_aggregate(self) -> None:
        # 2 events / (7200/60) = 2/120 per minute.
        response = self._request_table_rate("epm()")
        assert response.status_code == 200, response.content
        data = response.data["data"]
        assert len(data) == 1
        assert abs(data[0]["epm()"] - (2 / (7200 / 60))) < 0.001
        meta = response.data["meta"]
        assert meta["fields"]["epm()"] == "rate"
        assert meta["units"]["epm()"] == "1/minute"

    def test_count_unique_table(
        self,
    ) -> None:
        """Reference: test_organization_events.test_aggregate_field_with_dotted_param (errors).
        count_unique(attr) returns distinct count of attr; occurrences must have group_id."""
        group = self.create_group(project=self.project)
        # Two levels → count_unique(level) = 2; same group_id → count_unique(group_id) = 1.
        self.store_eap_items(
            [
                self.create_eap_occurrence(
                    group_id=group.id,
                    project=self.project,
                    level="error",
                    attributes={"fingerprint": ["a"]},
                ),
                self.create_eap_occurrence(
                    group_id=group.id,
                    project=self.project,
                    level="warning",
                    attributes={"fingerprint": ["a"]},
                ),
            ]
        )
        with self.options(
            {EAPOccurrencesComparator._callsite_allowlist_option_name(): self.callsite_name}
        ):
            response = self.do_request(
                {
                    "field": ["count()", "count_unique(level)"],
                    "statsPeriod": "1h",
                    "project": [self.project.id],
                    "dataset": "occurrences",
                }
            )
        assert response.status_code == 200, response.content
        data = response.data["data"]
        assert len(data) == 1
        assert data[0]["count()"] == 2
        assert data[0]["count_unique(level)"] == 2

    def test_count_if_table(
        self,
    ) -> None:
        """Reference: test_transactions.test_count_if_function (errors/transactions).
        count_if(attr,op,value) counts rows where attr matches; occurrences must have group_id."""
        group = self.create_group(project=self.project)
        # 3 with level=error, 2 with level=warning.
        for _ in range(3):
            self.store_eap_items(
                [
                    self.create_eap_occurrence(
                        group_id=group.id,
                        project=self.project,
                        level="error",
                        attributes={"fingerprint": ["x"]},
                    )
                ]
            )
        for _ in range(2):
            self.store_eap_items(
                [
                    self.create_eap_occurrence(
                        group_id=group.id,
                        project=self.project,
                        level="warning",
                        attributes={"fingerprint": ["x"]},
                    )
                ]
            )
        with self.options(
            {EAPOccurrencesComparator._callsite_allowlist_option_name(): self.callsite_name}
        ):
            response = self.do_request(
                {
                    "field": [
                        "count()",
                        "count_if(level,equals,error)",
                        "count_if(level,notEquals,error)",
                    ],
                    "statsPeriod": "1h",
                    "project": [self.project.id],
                    "dataset": "occurrences",
                }
            )
        assert response.status_code == 200, response.content
        data = response.data["data"]
        assert len(data) == 1
        assert data[0]["count()"] == 5
        assert data[0]["count_if(level,equals,error)"] == 3
        assert data[0]["count_if(level,notEquals,error)"] == 2

    def test_last_seen_table(
        self,
    ) -> None:
        """Reference: search/events/fields.py last_seen aggregate (errors: max(timestamp)).
        last_seen() returns max(timestamp) in ms; occurrences must have group_id."""
        group = self.create_group(project=self.project)
        base = before_now(hours=1)
        # One at base, one 10 min later.
        self.store_eap_items(
            [
                self.create_eap_occurrence(
                    group_id=group.id,
                    project=self.project,
                    timestamp=base,
                    attributes={"fingerprint": ["a"]},
                ),
                self.create_eap_occurrence(
                    group_id=group.id,
                    project=self.project,
                    timestamp=base + timedelta(minutes=10),
                    attributes={"fingerprint": ["a"]},
                ),
            ]
        )
        with self.options(
            {EAPOccurrencesComparator._callsite_allowlist_option_name(): self.callsite_name}
        ):
            response = self.do_request(
                {
                    "field": ["last_seen()"],
                    "statsPeriod": "2h",
                    "project": [self.project.id],
                    "dataset": "occurrences",
                }
            )
        assert response.status_code == 200, response.content
        data = response.data["data"]
        assert len(data) == 1
        # EAP returns last_seen as Unix timestamp in seconds (float).
        expected_seconds = (base + timedelta(minutes=10)).timestamp()
        assert abs(data[0]["last_seen()"] - expected_seconds) < 1
