import uuid
from datetime import timedelta

import pytest
from rest_framework.response import Response

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

    def request_with_feature_flag(self, payload: dict) -> Response:
        with self.options(
            {EAPOccurrencesComparator._callsite_allowlist_option_name(): self.callsite_name}
        ):
            response = self.do_request({**payload, "dataset": "occurrences"})
        assert response.status_code == 200, response.content
        return response

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

        response = self.request_with_feature_flag(
            {
                "field": ["id", "group_id", "trace"],
                "project": [self.project.id],
            }
        )
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

        response = self.request_with_feature_flag(
            {
                "field": ["count()", "group_id"],
                "statsPeriod": "1h",
                "query": f"project:{group.project.slug} group_id:{group.id}",
            }
        )

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
        return self.request_with_feature_flag(
            {
                "field": [field],
                "statsPeriod": "2h",
                "project": [self.project.id],
            }
        )

    def test_eps_rate_aggregate(self) -> None:
        # 2 events / 7200 seconds (2h).
        response = self._request_table_rate("eps()")
        data = response.data["data"]
        assert len(data) == 1
        assert data[0]["eps()"] == pytest.approx(2 / 7200, abs=0.0001)
        meta = response.data["meta"]
        assert meta["fields"]["eps()"] == "rate"
        assert meta["units"]["eps()"] == "1/second"

    def test_epm_rate_aggregate(self) -> None:
        # 2 events / (7200/60) = 2/120 per minute.
        response = self._request_table_rate("epm()")
        data = response.data["data"]
        assert len(data) == 1
        assert data[0]["epm()"] == pytest.approx(2 / (7200 / 60), abs=0.001)
        meta = response.data["meta"]
        assert meta["fields"]["epm()"] == "rate"
        assert meta["units"]["epm()"] == "1/minute"

    def test_count_unique(self) -> None:
        group = self.create_group(project=self.project)
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
                    level="error",
                    attributes={"fingerprint": ["b"]},
                ),
            ]
        )
        response = self.request_with_feature_flag(
            {
                "field": ["count()", "count_unique(level)"],
                "statsPeriod": "1h",
                "project": [self.project.id],
            }
        )
        data = response.data["data"]
        assert len(data) == 1
        assert data[0]["count()"] == 2
        assert data[0]["count_unique(level)"] == 1

    def test_count_if(
        self,
    ) -> None:
        group = self.create_group(project=self.project)
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

        response = self.request_with_feature_flag(
            {
                "field": [
                    "count()",
                    "count_if(level,equals,error)",
                    "count_if(level,notEquals,error)",
                ],
                "statsPeriod": "1h",
                "project": [self.project.id],
            }
        )
        data = response.data["data"]
        assert len(data) == 1
        assert data[0]["count()"] == 5
        assert data[0]["count_if(level,equals,error)"] == 3
        assert data[0]["count_if(level,notEquals,error)"] == 2

    def test_last_seen_table(
        self,
    ) -> None:
        group = self.create_group(project=self.project)
        base = before_now(hours=1)
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

        response = self.request_with_feature_flag(
            {
                "field": ["last_seen()"],
                "statsPeriod": "2h",
                "project": [self.project.id],
            }
        )

        data = response.data["data"]
        assert len(data) == 1
        # EAP returns last_seen as Unix timestamp in seconds (float).
        expected_seconds = (base + timedelta(minutes=10)).timestamp()
        assert data[0]["last_seen()"] == pytest.approx(expected_seconds, abs=1)

    @pytest.mark.skip(reason="VCC Support for Integer is blocking: EAP-462")
    def test_virtual_column_issue_in_fields(self):
        """Test Virtual Column (issue) is in response fields"""
        group = self.create_group(project=self.project)
        occurrences = [
            self.create_eap_occurrence(
                group_id=group.id,
                project=self.project,
                attributes={"fingerprint": ["g1"]},
            ),
        ]
        self.store_eap_items(occurrences)
        response = self.request_with_feature_flag(
            {
                "field": [
                    "issue",
                    "group_id",
                    "project",
                    "project.name",
                ],
                "statsPeriod": "2h",
                "project": [self.project.id],
            }
        )
        data = response.data["data"]
        assert len(data) == 1
        assert data[0]["issue"] == group.qualified_short_id

    def test_issue_filter(self):
        group1 = self.create_group(project=self.project)
        group2 = self.create_group(project=self.project)
        occurrences = [
            self.create_eap_occurrence(
                group_id=group1.id,
                project=self.project,
                attributes={"fingerprint": ["g1"]},
            ),
            self.create_eap_occurrence(
                group_id=group2.id,
                project=self.project,
                attributes={"fingerprint": ["g2"]},
            ),
        ]
        self.store_eap_items(occurrences)
        response = self.request_with_feature_flag(
            {
                "query": f"issue:{group1.qualified_short_id}",
                "field": ["group_id", "project", "project.name"],
                "statsPeriod": "2h",
                "project": [self.project.id],
            }
        )
        data = response.data["data"]
        assert len(data) == 1
        assert data[0]["group_id"] == group1.id

    def test_has_filter_on_project(self) -> None:
        group1 = self.create_group(project=self.project)
        occurrences = [
            self.create_eap_occurrence(
                group_id=group1.id,
                project=self.project,
                attributes={"fingerprint": ["g1"]},
            ),
            self.create_eap_occurrence(
                project=self.project,
                attributes={"fingerprint": ["g2"]},
            ),
        ]
        self.store_eap_items(occurrences)
        response = self.request_with_feature_flag(
            {
                "query": "has:issue",
                "field": ["group_id", "project", "project.name"],
                "statsPeriod": "2h",
                "project": [self.project.id],
            }
        )
        data = response.data["data"]
        assert len(data) == 1
        assert data[0]["group_id"] == group1.id

    def test_additional_query_with_logs(self) -> None:
        grp_a = self.create_group(project=self.project)
        grp_b = self.create_group(project=self.project)
        trace_id = uuid.uuid4().hex
        excluded_trace_id = uuid.uuid4().hex
        occurrences = [
            self.create_eap_occurrence(
                group_id=grp_a.id,
                project=self.project,
                tags={"foo": "five"},
                title="baz",
                trace_id=trace_id,
            ),
            self.create_eap_occurrence(
                group_id=grp_b.id,
                project=self.project,
                tags={"foo": "eight"},
                title="baz",
                trace_id=excluded_trace_id,
            ),
        ]
        logs = [
            self.create_ourlog(
                extra_data={"trace_id": trace_id, "body": "foo"},
            ),
            self.create_ourlog(
                extra_data={"trace_id": excluded_trace_id, "body": "bar"},
            ),
        ]
        self.store_eap_items(logs + occurrences)

        response = self.request_with_feature_flag(
            {
                "query": "title:baz",
                "field": ["title", "trace"],
                "project": [self.project.id],
                "logQuery": ["message:foo"],
            }
        )
        assert len(response.data["data"]) == 1
        assert response.data["data"][0]["trace"] == trace_id

    def test_sampled_vs_upsampled_eps(self):
        group1 = self.create_group(project=self.project)
        group2 = self.create_group(project=self.project)
        occurrences = [
            self.create_eap_occurrence(
                group_id=group1.id,
                project=self.project,
                attributes={"fingerprint": ["g1"]},
                client_sample_rate=0.1,
            ),
            self.create_eap_occurrence(
                group_id=group2.id,
                project=self.project,
                attributes={"fingerprint": ["g2"]},
            ),
            self.create_eap_occurrence(
                group_id=group2.id,
                project=self.project,
                attributes={"fingerprint": ["g2"]},
            ),
        ]

        self.store_eap_items(occurrences)
        response = self.request_with_feature_flag(
            {
                "field": ["eps()", "sample_eps()", "group_id"],
                "statsPeriod": "2h",
                "project": [self.project.id],
            }
        )
        data = response.data["data"]
        meta = response.data["meta"]
        assert len(data) == 2
        data = sorted(data, key=lambda x: x["group_id"])
        group1_data = data[0]
        group2_data = data[1]
        # Group1, sample rate => 0.1 => 10,
        # Group2 no sample rate.
        assert group1_data["sample_eps()"] == pytest.approx(1 / 7200, abs=0.001)
        assert group1_data["eps()"] == pytest.approx(10 / 7200, abs=0.001)

        assert group2_data["sample_eps()"] == pytest.approx(2 / 7200, abs=0.001)
        assert group2_data["eps()"] == pytest.approx(2 / 7200, abs=0.001)

        assert meta["fields"]["eps()"] == "rate"
        assert meta["units"]["eps()"] == "1/second"
        assert meta["fields"]["sample_eps()"] == "rate"
        assert meta["units"]["sample_eps()"] == "1/second"

    def test_sample_vs_upsampled_count(self):
        group1 = self.create_group(project=self.project)
        occurrences = [
            self.create_eap_occurrence(
                group_id=group1.id,
                project=self.project,
                attributes={"fingerprint": ["g1"]},
                client_sample_rate=0.1,
            )
        ]

        self.store_eap_items(occurrences)
        response = self.request_with_feature_flag(
            {
                "field": ["count()", "sample_count()", "group_id"],
                "statsPeriod": "2h",
                "project": [self.project.id],
            }
        )
        data = response.data["data"]
        assert len(data) == 1
        assert data[0]["count()"] == 10
        assert data[0]["sample_count()"] == 1
        assert data[0]["group_id"] == group1.id
