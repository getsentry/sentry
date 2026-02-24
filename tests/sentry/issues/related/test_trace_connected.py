import datetime
from uuid import uuid4

from sentry.issues.related.trace_connected import (
    _trace_connected_issues_eap,
    _trace_connected_issues_snuba,
)
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.testutils.cases import SnubaTestCase, TestCase
from sentry.testutils.helpers.datetime import freeze_time


class TestEAPTraceConnectedIssues(TestCase, SnubaTestCase):
    FROZEN_TIME = datetime.datetime(2026, 2, 12, 6, 0, 0, tzinfo=datetime.UTC)

    def _query_both(self, trace_id: str, exclude_group_id: int) -> tuple[set[int], set[int]]:
        organization = Organization.objects.get(id=self.organization.id)
        projects = list(Project.objects.filter(organization_id=self.organization.id))

        snuba_result = _trace_connected_issues_snuba(
            trace_id=trace_id,
            org_id=self.organization.id,
            project_ids=[p.id for p in projects],
            exclude_group_id=exclude_group_id,
        )
        eap_result = _trace_connected_issues_eap(
            trace_id=trace_id,
            organization=organization,
            projects=projects,
            exclude_group_id=exclude_group_id,
        )
        return snuba_result, eap_result

    @freeze_time(FROZEN_TIME)
    def test_eap_and_snuba_find_same_connected_issues(self) -> None:
        trace_id = uuid4().hex
        ts = (self.FROZEN_TIME - datetime.timedelta(minutes=5)).timestamp()
        group_a = self.store_events_to_snuba_and_eap("group-a", trace_id=trace_id, timestamp=ts)[
            0
        ].group_id
        group_b = self.store_events_to_snuba_and_eap("group-b", trace_id=trace_id, timestamp=ts)[
            0
        ].group_id
        group_c = self.store_events_to_snuba_and_eap("group-c", trace_id=trace_id, timestamp=ts)[
            0
        ].group_id
        assert group_a is not None
        assert group_b is not None
        assert group_c is not None

        snuba_result, eap_result = self._query_both(trace_id, exclude_group_id=group_a)

        assert snuba_result == {group_b, group_c}
        assert eap_result == snuba_result

    @freeze_time(FROZEN_TIME)
    def test_eap_and_snuba_return_empty_when_only_excluded_group(self) -> None:
        trace_id = uuid4().hex
        ts = (self.FROZEN_TIME - datetime.timedelta(minutes=5)).timestamp()
        group_id = self.store_events_to_snuba_and_eap(
            "only-group", count=3, trace_id=trace_id, timestamp=ts
        )[0].group_id
        assert group_id is not None

        snuba_result, eap_result = self._query_both(trace_id, exclude_group_id=group_id)

        assert snuba_result == set()
        assert eap_result == set()

    @freeze_time(FROZEN_TIME)
    def test_eap_and_snuba_isolate_by_trace(self) -> None:
        trace_a = uuid4().hex
        trace_b = uuid4().hex
        ts = (self.FROZEN_TIME - datetime.timedelta(minutes=5)).timestamp()
        group_a = self.store_events_to_snuba_and_eap("group-a", trace_id=trace_a, timestamp=ts)[
            0
        ].group_id
        group_b = self.store_events_to_snuba_and_eap("group-b", trace_id=trace_a, timestamp=ts)[
            0
        ].group_id
        group_c = self.store_events_to_snuba_and_eap("group-c", trace_id=trace_b, timestamp=ts)[
            0
        ].group_id
        assert group_a is not None
        assert group_b is not None
        assert group_c is not None

        snuba_result, eap_result = self._query_both(trace_a, exclude_group_id=group_a)

        assert snuba_result == {group_b}
        assert eap_result == snuba_result
        assert group_c not in snuba_result
