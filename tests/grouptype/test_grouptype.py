from collections import defaultdict
from dataclasses import dataclass
from unittest.mock import patch

from sentry.grouptype.grouptype import (
    GroupType,
    _category_lookup,
    _group_type_registry,
    get_group_type_by_slug,
    get_group_types_by_category,
)
from sentry.testutils import TestCase
from sentry.testutils.silo import region_silo_test
from sentry.types.issues import GroupCategory


@region_silo_test
class GroupTypeTest(TestCase):
    def test_get_types_by_category(self):
        with patch.dict(_group_type_registry, {}, clear=True), patch.dict(
            _category_lookup, defaultdict(set), clear=True
        ):

            @dataclass(frozen=True)
            class TestGroupType(GroupType):
                type_id = 1
                slug = "test"
                description = "Test"
                category = GroupCategory.ERROR.value
                ignore_limit = 0

            @dataclass(frozen=True)
            class TestGroupType2(GroupType):
                type_id = 2
                slug = "hellboy"
                description = "Hellboy"
                category = GroupCategory.PERFORMANCE.value

            @dataclass(frozen=True)
            class TestGroupType3(GroupType):
                type_id = 3
                slug = "angelgirl"
                description = "AngelGirl"
                category = GroupCategory.PERFORMANCE.value

            assert get_group_types_by_category(GroupCategory.PERFORMANCE.value) == {2, 3}
            assert get_group_types_by_category(GroupCategory.ERROR.value) == {1}

    def test_get_group_type_by_slug(self):
        with patch.dict(_group_type_registry, {}, clear=True):

            @dataclass(frozen=True)
            class TestGroupType(GroupType):
                type_id = 1
                slug = "test"
                description = "Test"
                category = GroupCategory.ERROR.value
                ignore_limit = 0

            assert get_group_type_by_slug(TestGroupType.slug) == TestGroupType

            nonexistent_slug = "meow"
            with self.assertRaisesMessage(
                ValueError, f"No group type with the slug {nonexistent_slug} is registered."
            ):
                get_group_type_by_slug(nonexistent_slug)

    def test_category_validation(self):
        with patch.dict(_group_type_registry, {}, clear=True):

            @dataclass(frozen=True)
            class TestGroupType(GroupType):
                type_id = 1
                slug = "error"
                description = "Error"
                category = 22

        with self.assertRaisesMessage(
            ValueError,
            f"Category must be one of {[category.value for category in GroupCategory]} from GroupCategory",
        ):
            TestGroupType(1, "error", "Error", 22)
