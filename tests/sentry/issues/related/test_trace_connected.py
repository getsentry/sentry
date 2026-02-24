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

    def _store_events_with_dual_write(self, trace_id: str, fingerprint: str, count: int = 1) -> int:
        with self.options({"eventstream.eap_forwarding_rate": 1.0}):
            event = None
            for _ in range(count):
                event = self.store_event(
                    data={
                        "message": f"error in {fingerprint}",
                        "fingerprint": [fingerprint],
                        "timestamp": (self.FROZEN_TIME - datetime.timedelta(minutes=5)).timestamp(),
                        "event_id": uuid4().hex,
                        "contexts": {"trace": {"trace_id": trace_id}},
                    },
                    project_id=self.project.id,
                    assert_no_errors=False,
                )
            assert event is not None and event.group_id is not None
            return event.group_id

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
        group_a = self._store_events_with_dual_write(trace_id, "group-a")
        group_b = self._store_events_with_dual_write(trace_id, "group-b")
        group_c = self._store_events_with_dual_write(trace_id, "group-c")

        snuba_result, eap_result = self._query_both(trace_id, exclude_group_id=group_a)

        assert snuba_result == {group_b, group_c}
        assert eap_result == snuba_result

    @freeze_time(FROZEN_TIME)
    def test_eap_and_snuba_return_empty_when_only_excluded_group(self) -> None:
        trace_id = uuid4().hex
        group_id = self._store_events_with_dual_write(trace_id, "only-group", count=3)

        snuba_result, eap_result = self._query_both(trace_id, exclude_group_id=group_id)

        assert snuba_result == set()
        assert eap_result == set()

    @freeze_time(FROZEN_TIME)
    def test_eap_and_snuba_isolate_by_trace(self) -> None:
        trace_a = uuid4().hex
        trace_b = uuid4().hex
        group_a = self._store_events_with_dual_write(trace_a, "group-a")
        group_b = self._store_events_with_dual_write(trace_a, "group-b")
        group_c = self._store_events_with_dual_write(trace_b, "group-c")

        snuba_result, eap_result = self._query_both(trace_a, exclude_group_id=group_a)

        assert snuba_result == {group_b}
        assert eap_result == snuba_result
        assert group_c not in snuba_result
