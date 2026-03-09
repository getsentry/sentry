import uuid
from datetime import timedelta

from sentry.search.eap.occurrences.rollout_utils import EAPOccurrencesComparator
from sentry.testutils.cases import BaseOccurrenceTestCase
from sentry.testutils.helpers.datetime import before_now
from tests.snuba.api.endpoints.test_organization_events import (
    OrganizationEventsEndpointTestBase,
)


class OrganizationEventsOccurrencesDatasetEndpointTest(
    OrganizationEventsEndpointTestBase, BaseOccurrenceTestCase
):
    callsite_name = "api.events.endpoints"

    def setUp(self) -> None:
        super().setUp()
        self.reference_time = before_now(days=1).replace(hour=10, minute=0, second=0, microsecond=0)

    def do_occurrences_request(self, query, features=None):
        query = {**query, "dataset": "occurrences"}
        with self.options(
            {EAPOccurrencesComparator._callsite_allowlist_option_name(): self.callsite_name}
        ):
            return self.do_request(query, features=features)

    def test_simple(self) -> None:
        event_id = uuid.uuid4().hex
        trace_id = uuid.uuid4().hex
        occ, group = self.create_occurrence(
            data={
                "event_id": event_id,
                "fingerprint": ["group1"],
                "contexts": {"trace": {"trace_id": trace_id}},
            },
            project=self.project,
        )
        self.store_eap_items([occ])

        response = self.do_occurrences_request(
            {
                "field": ["id", "group_id", "trace"],
                "project": [self.project.id],
            }
        )
        assert response.status_code == 200
        assert len(response.data["data"]) == 1
        row = response.data["data"][0]
        assert row["id"] == event_id
        assert row["trace"] == trace_id
        assert row["group_id"] == group.group_id

    def test_group_id(self) -> None:
        event_id = uuid.uuid4().hex
        trace_id = uuid.uuid4().hex
        occ, group = self.create_occurrence(
            data={
                "event_id": event_id,
                "fingerprint": ["group1"],
                "contexts": {"trace": {"trace_id": trace_id}},
            },
            project=self.project,
        )
        self.store_eap_items([occ])

        response = self.do_occurrences_request(
            {
                "field": ["count()"],
                "statsPeriod": "1h",
                "query": f"project:{group.project.slug} group_id:{group.group_id}",
            }
        )
        assert response.status_code == 200, response.content
        assert response.data["data"][0]["count()"] == 1

    def test_generic_group_ids_filter(self) -> None:
        timestamp = self.reference_time + timedelta(minutes=10)
        trace_id_1 = uuid.uuid4().hex
        trace_id_2 = uuid.uuid4().hex
        event_id_1 = uuid.uuid4().hex
        event_id_2 = uuid.uuid4().hex

        occ_1, group_1 = self.create_occurrence(
            data={
                "event_id": event_id_1,
                "fingerprint": ["group1"],
                "title": "something bad happened",
                "release": "1.2.3",
                "environment": "prod",
                "transaction": "/api/123",
                "timestamp": timestamp.timestamp(),
                "contexts": {"trace": {"trace_id": trace_id_1}},
            },
            project=self.project,
        )
        occ_2, group_2 = self.create_occurrence(
            data={
                "event_id": event_id_2,
                "fingerprint": ["group2"],
                "title": "another bad thing happened",
                "release": "1.2.4",
                "environment": "prod",
                "transaction": "/api/456",
                "timestamp": timestamp.timestamp(),
                "contexts": {"trace": {"trace_id": trace_id_2}},
            },
            project=self.project,
        )
        self.store_eap_items([occ_1, occ_2])

        response = self.do_occurrences_request(
            {
                "field": ["title", "release", "environment", "timestamp"],
                "statsPeriod": "90d",
                "query": f"group_id:{group_2.group_id}",
            }
        )
        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 1
        assert response.data["data"][0] == {
            "title": "another bad thing happened",
            "release": "1.2.4",
            "environment": "prod",
            "timestamp": timestamp.replace(microsecond=0).isoformat(),
        }

    def test_multiple_group_ids_filter(self) -> None:
        occ_1, group_1 = self.create_occurrence(
            data={
                "event_id": uuid.uuid4().hex,
                "fingerprint": ["group1"],
                "title": "N+1 Query",
                "transaction": "/books/",
            },
            project=self.project,
        )
        occ_2, group_2 = self.create_occurrence(
            data={
                "event_id": uuid.uuid4().hex,
                "fingerprint": ["group2"],
                "title": "Slow DB Query",
                "transaction": "/authors/",
            },
            project=self.project,
        )
        self.store_eap_items([occ_1, occ_2])

        response = self.do_occurrences_request(
            {
                "field": ["count()"],
                "statsPeriod": "1h",
                "query": f"project:{group_1.project.slug} group_id:[{group_1.group_id},{group_2.group_id}]",
            }
        )
        assert response.status_code == 200, response.content
        assert response.data["data"][0]["count()"] == 2

    def test_occurrence_descriptive_fields(self) -> None:
        event_id = uuid.uuid4().hex
        trace_id = uuid.uuid4().hex
        timestamp = self.reference_time + timedelta(minutes=10)
        occ, group = self.create_occurrence(
            data={
                "event_id": event_id,
                "fingerprint": ["group1"],
                "title": "A migrated occurrence",
                "release": "frontend@1.0.0",
                "environment": "production",
                "transaction": "/issue-platform-demo/page/1",
                "level": "warning",
                "type": "generic",
                "timestamp": timestamp.timestamp(),
                "contexts": {"trace": {"trace_id": trace_id}},
            },
            project=self.project,
        )
        self.store_eap_items([occ])

        response = self.do_occurrences_request(
            {
                "field": [
                    "transaction",
                    "title",
                    "release",
                    "environment",
                    "timestamp",
                ],
                "statsPeriod": "1h",
                "project": [self.project.id],
                "query": f"group_id:{group.group_id}",
            }
        )
        assert response.status_code == 200, response.content
        assert response.data["data"][0] == {
            "transaction": "/issue-platform-demo/page/1",
            "title": "A migrated occurrence",
            "release": "frontend@1.0.0",
            "environment": "production",
            "timestamp": timestamp.replace(microsecond=0).isoformat(),
        }

    def test_filters_on_release_and_environment(self) -> None:
        matching_timestamp = self.reference_time + timedelta(minutes=10)
        non_matching_timestamp = self.reference_time + timedelta(minutes=11)

        matching_occ, _ = self.create_occurrence(
            data={
                "event_id": uuid.uuid4().hex,
                "fingerprint": ["group1"],
                "title": "matching occurrence",
                "release": "frontend@2.0.0",
                "environment": "staging",
                "transaction": "/release-match",
                "timestamp": matching_timestamp.timestamp(),
                "contexts": {"trace": {"trace_id": uuid.uuid4().hex}},
            },
            project=self.project,
        )
        non_matching_occ, _ = self.create_occurrence(
            data={
                "event_id": uuid.uuid4().hex,
                "fingerprint": ["group2"],
                "title": "non matching occurrence",
                "release": "frontend@1.9.9",
                "environment": "production",
                "transaction": "/release-miss",
                "timestamp": non_matching_timestamp.timestamp(),
                "contexts": {"trace": {"trace_id": uuid.uuid4().hex}},
            },
            project=self.project,
        )
        self.store_eap_items([matching_occ, non_matching_occ])

        response = self.do_occurrences_request(
            {
                "field": ["title", "release", "environment", "transaction", "timestamp"],
                "statsPeriod": "90d",
                "project": [self.project.id],
                "query": "release:frontend@2.0.0 environment:staging",
            }
        )
        assert response.status_code == 200, response.content
        assert response.data["data"] == [
            {
                "title": "matching occurrence",
                "release": "frontend@2.0.0",
                "environment": "staging",
                "transaction": "/release-match",
                "timestamp": matching_timestamp.replace(microsecond=0).isoformat(),
            }
        ]

    def test_groupby_group_id(self) -> None:
        first_occ, first_group = self.create_occurrence(
            data={
                "event_id": uuid.uuid4().hex,
                "fingerprint": ["group1"],
                "title": "Grouped occurrence A",
                "contexts": {"trace": {"trace_id": uuid.uuid4().hex}},
            },
            project=self.project,
        )
        second_occ, _ = self.create_occurrence(
            data={
                "event_id": uuid.uuid4().hex,
                "fingerprint": ["group2"],
                "title": "Grouped occurrence B",
                "contexts": {"trace": {"trace_id": uuid.uuid4().hex}},
            },
            project=self.project,
        )
        second_occ.attributes["group_id"].int_value = first_group.group_id
        third_occ, third_group = self.create_occurrence(
            data={
                "event_id": uuid.uuid4().hex,
                "fingerprint": ["group3"],
                "title": "Grouped occurrence C",
                "contexts": {"trace": {"trace_id": uuid.uuid4().hex}},
            },
            project=self.project,
        )
        self.store_eap_items([first_occ, second_occ, third_occ])

        response = self.do_occurrences_request(
            {
                "field": ["group_id", "count()"],
                "statsPeriod": "1h",
                "project": [self.project.id],
                "sort": "group_id",
            }
        )
        assert response.status_code == 200, response.content
        assert response.data["data"] == [
            {"group_id": first_group.group_id, "count()": 2},
            {"group_id": third_group.group_id, "count()": 1},
        ]

    def test_orderby_timestamp_and_title(self) -> None:
        older_timestamp = self.reference_time + timedelta(minutes=10)
        newer_timestamp = self.reference_time + timedelta(minutes=11)

        older_occ, older_group = self.create_occurrence(
            data={
                "event_id": uuid.uuid4().hex,
                "fingerprint": ["group1"],
                "title": "Zulu occurrence",
                "transaction": "/older",
                "timestamp": older_timestamp.timestamp(),
                "contexts": {"trace": {"trace_id": uuid.uuid4().hex}},
            },
            project=self.project,
        )
        newer_occ, newer_group = self.create_occurrence(
            data={
                "event_id": uuid.uuid4().hex,
                "fingerprint": ["group2"],
                "title": "Alpha occurrence",
                "transaction": "/newer",
                "timestamp": newer_timestamp.timestamp(),
                "contexts": {"trace": {"trace_id": uuid.uuid4().hex}},
            },
            project=self.project,
        )
        self.store_eap_items([older_occ, newer_occ])

        timestamp_response = self.do_occurrences_request(
            {
                "field": ["group_id", "title", "timestamp"],
                "statsPeriod": "1h",
                "project": [self.project.id],
                "sort": "-timestamp",
            }
        )
        assert timestamp_response.status_code == 200, timestamp_response.content
        assert timestamp_response.data["data"] == [
            {
                "group_id": newer_group.group_id,
                "title": "Alpha occurrence",
                "timestamp": newer_timestamp.replace(microsecond=0).isoformat(),
            },
            {
                "group_id": older_group.group_id,
                "title": "Zulu occurrence",
                "timestamp": older_timestamp.replace(microsecond=0).isoformat(),
            },
        ]

        title_response = self.do_occurrences_request(
            {
                "field": ["group_id", "title", "timestamp"],
                "statsPeriod": "1h",
                "project": [self.project.id],
                "sort": "title",
            }
        )
        assert title_response.status_code == 200, title_response.content
        assert title_response.data["data"] == [
            {
                "group_id": newer_group.group_id,
                "title": "Alpha occurrence",
                "timestamp": newer_timestamp.replace(microsecond=0).isoformat(),
            },
            {
                "group_id": older_group.group_id,
                "title": "Zulu occurrence",
                "timestamp": older_timestamp.replace(microsecond=0).isoformat(),
            },
        ]
