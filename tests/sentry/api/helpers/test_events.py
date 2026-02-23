from __future__ import annotations

import datetime
from typing import Any
from uuid import uuid4

from sentry.api.helpers.events import get_events_for_group_eap, get_query_builder_for_group
from sentry.models.group import Group
from sentry.search.events.types import SnubaParams
from sentry.testutils.cases import SnubaTestCase, TestCase
from sentry.testutils.helpers.datetime import freeze_time


class TestEAPRunGroupEventsQuery(TestCase, SnubaTestCase):
    FROZEN_TIME = datetime.datetime(2026, 2, 12, 6, 0, 0, tzinfo=datetime.UTC)

    def _store_events_with_dual_write(
        self, fingerprint: str, count: int = 1
    ) -> tuple[int, list[str]]:
        event_ids: list[str] = []
        group_id: int | None = None
        with self.options({"eventstream.eap_forwarding_rate": 1.0}):
            for _ in range(count):
                event_id = uuid4().hex
                event = self.store_event(
                    data={
                        "message": f"error in {fingerprint}",
                        "fingerprint": [fingerprint],
                        "timestamp": (self.FROZEN_TIME - datetime.timedelta(minutes=5)).timestamp(),
                        "event_id": event_id,
                        "contexts": {"trace": {"trace_id": uuid4().hex}},
                    },
                    project_id=self.project.id,
                    assert_no_errors=False,
                )
                event_ids.append(event_id)
                group_id = event.group_id
        assert group_id is not None
        return group_id, event_ids

    def _query_both(self, group_id: int) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
        group = Group.objects.get(id=group_id)
        snuba_params = SnubaParams(
            start=self.FROZEN_TIME - datetime.timedelta(days=1),
            end=self.FROZEN_TIME,
            organization=self.organization,
            projects=[self.project],
            environments=[],
        )

        snuba_query = get_query_builder_for_group(
            query="",
            snuba_params=snuba_params,
            group=group,
            limit=100,
            offset=0,
        )
        snuba_data = snuba_query.run_query(referrer="test")["data"]

        eap_data = get_events_for_group_eap(
            query="",
            snuba_params=snuba_params,
            group=group,
            limit=100,
            offset=0,
            orderby=None,
            referrer="test",
        )

        return snuba_data, eap_data

    @freeze_time(FROZEN_TIME)
    def test_eap_and_snuba_return_same_events(self) -> None:
        group_id, event_ids = self._store_events_with_dual_write("my-group", count=3)

        snuba_data, eap_data = self._query_both(group_id)

        snuba_ids = {row["id"] for row in snuba_data}
        eap_ids = {row["id"] for row in eap_data}

        assert len(snuba_ids) == 3
        assert snuba_ids == eap_ids

    @freeze_time(FROZEN_TIME)
    def test_eap_and_snuba_isolate_groups(self) -> None:
        group_a, _event_ids_a = self._store_events_with_dual_write("group-a", count=2)
        group_b, _event_ids_b = self._store_events_with_dual_write("group-b", count=1)

        snuba_data_a, eap_data_a = self._query_both(group_a)
        snuba_data_b, eap_data_b = self._query_both(group_b)

        snuba_ids_a = {row["id"] for row in snuba_data_a}
        eap_ids_a = {row["id"] for row in eap_data_a}
        snuba_ids_b = {row["id"] for row in snuba_data_b}
        eap_ids_b = {row["id"] for row in eap_data_b}

        assert snuba_ids_a == eap_ids_a
        assert len(snuba_ids_a) == 2
        assert snuba_ids_b == eap_ids_b
        assert len(snuba_ids_b) == 1
        assert snuba_ids_a.isdisjoint(snuba_ids_b)
