from dataclasses import dataclass

from sentry.grouptype.grouptype import GroupType, get_group_types_by_category
from sentry.testutils import TestCase
from sentry.testutils.silo import region_silo_test
from sentry.types.issues import GroupCategory


@region_silo_test
class GroupTypeTest(TestCase):
    def test_get_types_by_category(self):
        assert get_group_types_by_category(GroupCategory.PERFORMANCE.value) == [
            1001,
            1004,
            1006,
            1007,
            1008,
            1010,
            1011,
            1012,
        ]
        assert get_group_types_by_category(GroupCategory.PROFILE.value) == [2000]
        assert get_group_types_by_category(GroupCategory.ERROR.value) == [1]

    def test_category_validation(self):
        @dataclass(frozen=True)
        class TestGroupType(GroupType):
            type_id = 1
            slug = "error"
            description = "Error"
            category = 22

        with self.assertRaisesMessage(
            ValueError, "Category must be one of [1, 2, 3] from GroupCategory"
        ):
            TestGroupType(1, "error", "Error", 22)
