from sentry.models.groupredirect import GroupRedirect
from sentry.services.eventstore.query_preprocessing import get_all_merged_group_ids
from sentry.testutils.cases import TestCase
from sentry.testutils.skips import requires_snuba

pytestmark = [requires_snuba]


class TestQueryPreprocessing(TestCase):
    def test_get_all_merged_group_ids(self) -> None:
        g1 = self.create_group(id=1)
        g2 = self.create_group(id=2)
        g3 = self.create_group(id=3)
        self.create_group(id=4)

        GroupRedirect.objects.create(
            organization_id=g1.project.organization_id,
            group_id=g1.id,
            previous_group_id=g2.id,
        )
        GroupRedirect.objects.create(
            organization_id=g1.project.organization_id,
            group_id=g1.id,
            previous_group_id=g3.id,
        )

        assert get_all_merged_group_ids([g1.id]) == {g1.id, g2.id, g3.id}
        assert get_all_merged_group_ids([g2.id]) == {g1.id, g2.id}
        assert get_all_merged_group_ids([g3.id]) == {g1.id, g3.id}
        assert get_all_merged_group_ids([g2.id, g3.id]) == {g1.id, g2.id, g3.id}
