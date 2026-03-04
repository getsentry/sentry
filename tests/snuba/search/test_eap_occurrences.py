from __future__ import annotations

from datetime import datetime, timedelta
from uuid import uuid4

import pytest

from sentry.search.eap.occurrences.common_queries import (
    count_occurrences,
    count_occurrences_grouped_by_trace_ids,
    get_group_ids_for_trace_id,
    get_group_to_trace_ids_map,
)
from sentry.search.eap.occurrences.query_utils import (
    build_escaped_term_filter,
    build_snuba_params_from_ids,
    keyed_counts_subset_match,
)
from sentry.search.eap.types import EAPResponse, SearchResolverConfig
from sentry.search.events.types import SnubaParams
from sentry.snuba.occurrences_rpc import OccurrenceCategory, Occurrences
from sentry.testutils.cases import OccurrenceTestCase, SnubaTestCase, TestCase
from sentry.testutils.helpers.datetime import before_now


class EAPOccurrencesTest(TestCase, SnubaTestCase, OccurrenceTestCase):
    def _query_occurrences(
        self,
        query_string: str = "",
        selected_columns: list[str] | None = None,
        occurrence_category: OccurrenceCategory | None = None,
    ) -> EAPResponse:
        if selected_columns is None:
            selected_columns = ["count()"]

        now = datetime.now()
        snuba_params = SnubaParams(
            start=now - timedelta(hours=1),
            end=now + timedelta(hours=1),
            organization=self.organization,
            projects=[self.project],
        )

        return Occurrences.run_table_query(
            params=snuba_params,
            query_string=query_string,
            selected_columns=selected_columns,
            orderby=None,
            offset=0,
            limit=10,
            referrer="test.eap_occurrences",
            config=SearchResolverConfig(),
            occurrence_category=occurrence_category,
        )

    def test_create_and_store_occurrence(self) -> None:
        group = self.create_group(project=self.project)

        trace_item = self.create_eap_occurrence(
            group_id=group.id,
            title="test error",
            level="error",
        )
        self.store_occurrences([trace_item])

        result = self._query_occurrences(query_string=f"group_id:{group.id}")
        assert len(result["data"]) == 1
        assert result["data"][0]["count()"] == 1

    def test_occurrence_type_filtering(self) -> None:
        group_error = self.create_group(project=self.project)
        group_generic = self.create_group(project=self.project)

        error_occurrence = self.create_eap_occurrence(
            group_id=group_error.id,
            occurrence_type="error",
        )
        generic_occurrence = self.create_eap_occurrence(
            group_id=group_generic.id,
            occurrence_type="generic",
        )
        self.store_occurrences([error_occurrence, generic_occurrence])

        # OccurrenceCategory.ERROR filters for type != "generic"
        error_result = self._query_occurrences(
            occurrence_category=OccurrenceCategory.ERROR,
        )
        assert error_result["data"][0]["count()"] == 1

        # OccurrenceCategory.GENERIC filters for type == "generic"
        generic_result = self._query_occurrences(
            occurrence_category=OccurrenceCategory.GENERIC,
        )
        assert generic_result["data"][0]["count()"] == 1

        # No category filter returns both
        all_result = self._query_occurrences()
        assert all_result["data"][0]["count()"] == 2

    def test_attributes_are_queryable(self) -> None:
        group = self.create_group(project=self.project)

        trace_item = self.create_eap_occurrence(
            group_id=group.id,
            level="warning",
            title="something broke",
            environment="production",
            transaction="/api/users",
        )
        self.store_occurrences([trace_item])

        result = self._query_occurrences(
            query_string=f"group_id:{group.id}",
            selected_columns=["level", "title", "environment", "transaction"],
        )
        assert len(result["data"]) == 1
        row = result["data"][0]
        assert row["level"] == "warning"
        assert row["title"] == "something broke"
        assert row["environment"] == "production"
        assert row["transaction"] == "/api/users"

    # TODO: once support for tags on occurrences in EAP is solidified, remove this skip
    @pytest.mark.skip(reason="tag encoding is still an open question for EAP")
    def test_tags_are_queryable(self) -> None:
        group = self.create_group(project=self.project)

        trace_item = self.create_eap_occurrence(
            group_id=group.id,
            tags={"browser": "chrome", "os": "linux"},
        )
        self.store_occurrences([trace_item])

        matching = self._query_occurrences(query_string="browser:chrome")
        assert len(matching["data"]) == 1
        assert matching["data"][0]["count()"] == 1

        non_matching = self._query_occurrences(query_string="browser:firefox")
        assert len(non_matching["data"]) == 0

    def test_multiple_occurrences_per_group(self) -> None:
        group = self.create_group(project=self.project)

        occurrences = [self.create_eap_occurrence(group_id=group.id) for _ in range(5)]
        self.store_occurrences(occurrences)

        result = self._query_occurrences(query_string=f"group_id:{group.id}")
        assert len(result["data"]) == 1
        assert result["data"][0]["count()"] == 5

    def test_eap_forwarding_rate_dual_write(self) -> None:
        events = self.store_events_to_snuba_and_eap(
            "dual-write-group",
            timestamp=before_now(minutes=1).timestamp(),
            extra_event_data={"tags": {"browser": "chrome"}},
        )
        event = events[0]
        assert event.group is not None

        result = self._query_occurrences(
            query_string=f"group_id:{event.group_id}",
            selected_columns=["group_id", "level", "title"],
        )
        assert len(result["data"]) == 1
        row = result["data"][0]
        assert row["group_id"] == event.group_id
        assert row["level"] == "error"
        assert row["title"] == event.title


class CountOccurrencesQueryTest(TestCase, SnubaTestCase, OccurrenceTestCase):
    def setUp(self) -> None:
        super().setUp()
        now = datetime.now()
        self.start = now - timedelta(hours=1)
        self.end = now + timedelta(hours=1)
        self.referrer = "test.occurrences_common_queries"

    def test_counts_all_occurrences(self) -> None:
        group = self.create_group(project=self.project)
        occurrences = [self.create_eap_occurrence(group_id=group.id) for _ in range(3)]
        self.store_occurrences(occurrences)

        result = count_occurrences(
            organization=self.organization,
            projects=[self.project],
            start=self.start,
            end=self.end,
            referrer=self.referrer,
        )
        assert result == 3

    def test_filters_by_group_id(self) -> None:
        group_1 = self.create_group(project=self.project)
        group_2 = self.create_group(project=self.project)
        self.store_occurrences(
            [
                self.create_eap_occurrence(group_id=group_1.id),
                self.create_eap_occurrence(group_id=group_2.id),
                self.create_eap_occurrence(group_id=group_2.id),
            ]
        )

        result_1 = count_occurrences(
            organization=self.organization,
            projects=[self.project],
            start=self.start,
            end=self.end,
            referrer=self.referrer,
            group_id=group_1.id,
        )
        assert result_1 == 1

        result_2 = count_occurrences(
            organization=self.organization,
            projects=[self.project],
            start=self.start,
            end=self.end,
            referrer=self.referrer,
            group_id=group_2.id,
        )
        assert result_2 == 2

    def test_filters_by_occurrence_category(self) -> None:
        group = self.create_group(project=self.project)
        self.store_occurrences(
            [
                self.create_eap_occurrence(group_id=group.id, occurrence_type="error"),
                self.create_eap_occurrence(group_id=group.id, occurrence_type="error"),
                self.create_eap_occurrence(group_id=group.id, occurrence_type="error"),
                self.create_eap_occurrence(group_id=group.id, occurrence_type="generic"),
                self.create_eap_occurrence(group_id=group.id, occurrence_type="generic"),
            ]
        )

        error_count = count_occurrences(
            organization=self.organization,
            projects=[self.project],
            start=self.start,
            end=self.end,
            referrer=self.referrer,
            occurrence_category=OccurrenceCategory.ERROR,
        )
        generic_count = count_occurrences(
            organization=self.organization,
            projects=[self.project],
            start=self.start,
            end=self.end,
            referrer=self.referrer,
            occurrence_category=OccurrenceCategory.GENERIC,
        )

        assert error_count == 3
        assert generic_count == 2

    def test_counts_grouped_by_trace_ids(self) -> None:
        group = self.create_group(project=self.project)
        trace_id_1 = uuid4().hex
        trace_id_2 = uuid4().hex
        self.store_occurrences(
            [
                self.create_eap_occurrence(group_id=group.id, trace_id=trace_id_1),
                self.create_eap_occurrence(group_id=group.id, trace_id=trace_id_1),
                self.create_eap_occurrence(group_id=group.id, trace_id=trace_id_2),
            ]
        )

        grouped = count_occurrences_grouped_by_trace_ids(
            snuba_params=SnubaParams(
                start=self.start,
                end=self.end,
                organization=self.organization,
                projects=[self.project],
            ),
            trace_ids=[trace_id_1, trace_id_2],
            referrer=self.referrer,
        )
        assert grouped == {trace_id_1: 2, trace_id_2: 1}

    def test_counts_grouped_by_trace_ids_with_occurrence_category(self) -> None:
        group = self.create_group(project=self.project)
        trace_id = uuid4().hex
        self.store_occurrences(
            [
                self.create_eap_occurrence(
                    group_id=group.id, trace_id=trace_id, occurrence_type="error"
                ),
                self.create_eap_occurrence(
                    group_id=group.id, trace_id=trace_id, occurrence_type="error"
                ),
                self.create_eap_occurrence(
                    group_id=group.id, trace_id=trace_id, occurrence_type="generic"
                ),
            ]
        )

        snuba_params = SnubaParams(
            start=self.start,
            end=self.end,
            organization=self.organization,
            projects=[self.project],
        )
        grouped_errors = count_occurrences_grouped_by_trace_ids(
            snuba_params=snuba_params,
            trace_ids=[trace_id],
            referrer=self.referrer,
            occurrence_category=OccurrenceCategory.ERROR,
        )
        grouped_generic = count_occurrences_grouped_by_trace_ids(
            snuba_params=snuba_params,
            trace_ids=[trace_id],
            referrer=self.referrer,
            occurrence_category=OccurrenceCategory.GENERIC,
        )

        assert grouped_errors == {trace_id: 2}
        assert grouped_generic == {trace_id: 1}

    def test_counts_grouped_by_trace_ids_empty_trace_ids(self) -> None:
        grouped = count_occurrences_grouped_by_trace_ids(
            snuba_params=SnubaParams(
                start=self.start,
                end=self.end,
                organization=self.organization,
                projects=[self.project],
            ),
            trace_ids=[],
            referrer=self.referrer,
        )
        assert grouped == {}

    def test_get_group_ids_for_trace_id(self) -> None:
        trace_id = uuid4().hex
        group_1 = self.create_group(project=self.project)
        group_2 = self.create_group(project=self.project)
        self.store_occurrences(
            [
                self.create_eap_occurrence(group_id=group_1.id, trace_id=trace_id),
                self.create_eap_occurrence(group_id=group_2.id, trace_id=trace_id),
            ]
        )

        group_ids = get_group_ids_for_trace_id(
            snuba_params=SnubaParams(
                start=self.start,
                end=self.end,
                organization=self.organization,
                projects=[self.project],
            ),
            trace_id=trace_id,
            referrer=self.referrer,
            limit=100,
            occurrence_category=OccurrenceCategory.ERROR,
        )
        assert group_ids == {group_1.id, group_2.id}

    def test_get_group_to_trace_ids_map(self) -> None:
        trace_id_1 = uuid4().hex
        trace_id_2 = uuid4().hex
        group_1 = self.create_group(project=self.project)
        group_2 = self.create_group(project=self.project)
        self.store_occurrences(
            [
                self.create_eap_occurrence(group_id=group_1.id, trace_id=trace_id_1),
                self.create_eap_occurrence(group_id=group_1.id, trace_id=trace_id_2),
                self.create_eap_occurrence(group_id=group_2.id, trace_id=trace_id_1),
            ]
        )

        grouped = get_group_to_trace_ids_map(
            snuba_params=SnubaParams(
                start=self.start,
                end=self.end,
                organization=self.organization,
                projects=[self.project],
            ),
            trace_ids=[trace_id_1, trace_id_2],
            referrer=self.referrer,
            limit=100,
            occurrence_category=OccurrenceCategory.ERROR,
            orderby=["-timestamp"],
        )
        assert grouped == {
            group_1.id: {trace_id_1, trace_id_2},
            group_2.id: {trace_id_1},
        }

    def test_build_snuba_params_from_ids(self) -> None:
        params = build_snuba_params_from_ids(
            organization_id=self.organization.id,
            project_ids=[self.project.id],
            start=self.start,
            end=self.end,
        )

        assert params is not None
        assert params.organization is not None
        assert params.organization.id == self.organization.id
        assert [project.id for project in params.projects] == [self.project.id]

    def test_build_snuba_params_from_ids_missing_org(self) -> None:
        params = build_snuba_params_from_ids(
            organization_id=-1,
            project_ids=[self.project.id],
            start=self.start,
            end=self.end,
        )
        assert params is None

    def test_build_snuba_params_from_ids_missing_projects(self) -> None:
        params = build_snuba_params_from_ids(
            organization_id=self.organization.id,
            project_ids=[-1],
            start=self.start,
            end=self.end,
        )
        assert params is None

    def test_build_escaped_term_filter(self) -> None:
        single = build_escaped_term_filter("release", ['v1"quoted'])
        multiple = build_escaped_term_filter("environment", ["prod", "dev"])

        assert single == 'release:"v1\\"quoted"'
        assert multiple == 'environment:["prod", "dev"]'

    def test_keyed_counts_subset_match(self) -> None:
        control_rows = [
            {"project_id": 1, "group_id": 11, "count()": 10},
            {"project_id": 1, "group_id": 12, "count()": 3},
        ]
        experimental_rows = [
            {"project_id": 1, "group_id": 11, "count()": 8},
            {"project_id": 1, "group_id": 12, "count()": 2},
        ]
        mismatched_rows = [{"project_id": 1, "group_id": 11, "count()": 11}]

        assert keyed_counts_subset_match(
            control_rows, experimental_rows, key_fn=lambda row: (row["project_id"], row["group_id"])
        )
        assert not keyed_counts_subset_match(
            control_rows, mismatched_rows, key_fn=lambda row: (row["project_id"], row["group_id"])
        )
