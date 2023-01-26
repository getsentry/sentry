from dataclasses import dataclass

from sentry.grouptype.grouptype import ErrorGroupType, GroupType
from sentry.testutils import TestCase
from sentry.testutils.silo import region_silo_test


@region_silo_test
class GroupTypeTest(TestCase):
    def test_get_category_by_slug(self):
        assert ErrorGroupType.get_category_by_slug(self, slug="ErrorGroupType") == 1

    def test_category_validation(self):
        @dataclass(frozen=True)
        class TestGroupType(GroupType):
            type_id = 1
            slug = "ERROR"
            description = "Error"
            category = 22

        with self.assertRaisesMessage(
            ValueError, "Category must be one of [1, 2, 3] from GroupCategory"
        ):
            TestGroupType(1, "ERROR", "Error", 22)
