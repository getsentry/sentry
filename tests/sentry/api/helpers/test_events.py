from __future__ import annotations

import datetime
from typing import Any

from sentry.api.helpers.events import get_events_for_group_eap, get_query_builder_for_group
from sentry.models.group import Group
from sentry.search.events.types import SnubaParams
from sentry.testutils.cases import SnubaTestCase, TestCase
from sentry.testutils.helpers.datetime import freeze_time


class TestEAPRunGroupEventsQuery(TestCase, SnubaTestCase):
    FROZEN_TIME = datetime.datetime(2026, 2, 12, 6, 0, 0, tzinfo=datetime.UTC)

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
        ts = (self.FROZEN_TIME - datetime.timedelta(minutes=5)).timestamp()
        events = self.store_events_to_snuba_and_eap("my-group", count=3, timestamp=ts)
        group_id = events[0].group_id
        assert group_id is not None

        snuba_data, eap_data = self._query_both(group_id)

        snuba_ids = {row["id"] for row in snuba_data}
        eap_ids = {row["id"] for row in eap_data}

        assert len(snuba_ids) == 3
        assert snuba_ids == eap_ids

    @freeze_time(FROZEN_TIME)
    def test_eap_and_snuba_isolate_groups(self) -> None:
        ts = (self.FROZEN_TIME - datetime.timedelta(minutes=5)).timestamp()
        events_a = self.store_events_to_snuba_and_eap("group-a", count=2, timestamp=ts)
        events_b = self.store_events_to_snuba_and_eap("group-b", count=1, timestamp=ts)
        group_id_a = events_a[0].group_id
        group_id_b = events_b[0].group_id
        assert group_id_a is not None
        assert group_id_b is not None

        snuba_data_a, eap_data_a = self._query_both(group_id_a)
        snuba_data_b, eap_data_b = self._query_both(group_id_b)

        snuba_ids_a = {row["id"] for row in snuba_data_a}
        eap_ids_a = {row["id"] for row in eap_data_a}
        snuba_ids_b = {row["id"] for row in snuba_data_b}
        eap_ids_b = {row["id"] for row in eap_data_b}

        assert snuba_ids_a == eap_ids_a
        assert len(snuba_ids_a) == 2
        assert snuba_ids_b == eap_ids_b
        assert len(snuba_ids_b) == 1
        assert snuba_ids_a.isdisjoint(snuba_ids_b)
