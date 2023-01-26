from sentry.grouptype.manager import GroupType, GroupTypeManager
from sentry.testutils import TestCase
from sentry.testutils.silo import region_silo_test


@region_silo_test
class GroupTypeManagerTest(TestCase):
    def test_group_type_manager(self):
        test_manager = GroupTypeManager()
        test_manager.add(
            GroupType(
                type_id=1,
                slug="ERROR",
                description="error",
                category=1,
                ignore_limit=3,
            )
        )
        assert test_manager.get_category_by_slug(slug="ERROR") == 1
