from datetime import UTC, datetime, timedelta

from sentry.models.groupredirect import GroupRedirect
from sentry.services.eventstore.query_preprocessing import (
    _get_all_related_redirects_query,
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
        self.create_group(id=4)

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

    def test_get_all_related_groups_query(self) -> None:
        """
        What we want is for this to return the newest redirects first.
        What we're technically doing is taking the redirects with the highest IDs.
        """
        assert _get_all_related_redirects_query({self.g1.id})[0] == (self.g1.id, self.g2.id)

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
