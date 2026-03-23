from datetime import UTC, datetime, timedelta

from sentry.models.groupredirect import GroupRedirect
from sentry.services.eventstore.query_preprocessing import (
    _build_group_redirect_by_group_id_cache_key,
    _try_get_from_cache,
    get_all_merged_group_ids,
)
from sentry.testutils.cases import TestCase
from sentry.testutils.skips import requires_snuba

pytestmark = [requires_snuba]


class TestQueryPreprocessing(TestCase):
    def setUp(self) -> None:
        self.g1 = self.create_group(id=1)
        self.g2 = self.create_group(id=2)
        self.g3 = self.create_group(id=3)
        self.g4 = self.create_group(id=4)

        self.gr31 = GroupRedirect.objects.create(
            id=10001,
            organization_id=self.g1.project.organization_id,
            group_id=self.g1.id,
            previous_group_id=self.g3.id,
            date_added=datetime.now(UTC) - timedelta(hours=4),
        )
        self.gr21 = GroupRedirect.objects.create(
            id=10002,
            organization_id=self.g1.project.organization_id,
            group_id=self.g1.id,
            previous_group_id=self.g2.id,
            date_added=datetime.now(UTC) - timedelta(hours=1),
        )

    def test_get_all_merged_group_ids(self) -> None:
        assert get_all_merged_group_ids([self.g1.id]) == {self.g1.id, self.g2.id, self.g3.id}
        assert get_all_merged_group_ids([self.g2.id]) == {self.g1.id, self.g2.id}
        assert get_all_merged_group_ids([self.g3.id]) == {self.g1.id, self.g3.id}
        assert get_all_merged_group_ids([self.g2.id, self.g3.id]) == {
            self.g1.id,
            self.g2.id,
            self.g3.id,
        }

    def test_threshold(self) -> None:
        group = self.create_group(id=128)
        i = 999

        local_threshold = 200

        for _ in range(local_threshold + 100):
            old = self.create_group(id=i)
            i += 1
            GroupRedirect.objects.create(
                organization_id=group.project.organization_id,
                group_id=group.id,
                previous_group_id=old.id,
                date_added=datetime.now(UTC) - timedelta(hours=1),
            )

        assert len(get_all_merged_group_ids([group.id], local_threshold)) <= local_threshold + 2

    def test_cache(self) -> None:
        from django.core.cache import cache

        cache.set(
            _build_group_redirect_by_group_id_cache_key(self.g1.id),
            {(self.g2.id, self.gr21.date_added), (self.g3.id, self.gr31.date_added)},
        )

        res = _try_get_from_cache({self.g1.id, self.g4.id})
        assert res == (
            {(self.g2.id, self.gr21.date_added), (self.g3.id, self.gr31.date_added)},
            {self.g4.id},
        )
