import uuid

from sentry.search.eap.occurrences.rollout_utils import EAPOccurrencesComparator
from sentry.testutils.cases import OccurrenceTestCase
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
