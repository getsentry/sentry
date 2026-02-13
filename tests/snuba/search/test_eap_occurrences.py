from __future__ import annotations

from datetime import datetime, timedelta
from uuid import uuid4

from sentry.search.eap.types import SearchResolverConfig
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
    ) -> dict:
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

    def test_eap_forwarding_rate_dual_write(self) -> None:
        trace_id = uuid4().hex

        with self.options({"eventstream.eap_forwarding_rate": 1.0}):
            event = self.store_event(
                data={
                    "message": "dual write test error",
                    "fingerprint": ["dual-write-group"],
                    "timestamp": before_now(minutes=1).timestamp(),
                    "contexts": {"trace": {"trace_id": trace_id}},
                },
                project_id=self.project.id,
                assert_no_errors=False,
            )

        assert event.group is not None

        result = self._query_occurrences(query_string=f"group_id:{event.group_id}")
        assert len(result["data"]) == 1
        assert result["data"][0]["count()"] > 0
