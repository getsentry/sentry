from dataclasses import dataclass
from datetime import timedelta
from unittest.mock import patch

from sentry.grouping.grouptype import ErrorGroupType
from sentry.issues.grouptype import (
    DEFAULT_EXPIRY_TIME,
    DEFAULT_IGNORE_LIMIT,
    GroupCategory,
    GroupType,
    GroupTypeRegistry,
    NoiseConfig,
    PerformanceNPlusOneGroupType,
    PerformanceSlowDBQueryGroupType,
    get_group_type_by_slug,
    get_group_types_by_category,
)
from sentry.testutils.cases import TestCase


class BaseGroupTypeTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.registry_patcher = patch("sentry.issues.grouptype.registry", new=GroupTypeRegistry())
        self.registry_patcher.__enter__()

        class ErrorGroupType(GroupType):
            type_id = -1
            slug = "error"
            description = "Error"
            category = GroupCategory.TEST_NOTIFICATION.value
            category_v2 = GroupCategory.TEST_NOTIFICATION.value

        class IssueStreamGroupType(GroupType):
            type_id = 0
            slug = "issue_stream"
            description = "Issue Stream"
            category = GroupCategory.TEST_NOTIFICATION.value
            category_v2 = GroupCategory.TEST_NOTIFICATION.value

    def tearDown(self) -> None:
        super().tearDown()
        self.registry_patcher.__exit__(None, None, None)


class GroupTypeTest(BaseGroupTypeTest):
    def test_get_types_by_category(self) -> None:
        @dataclass(frozen=True)
        class TestGroupType(GroupType):
            type_id = 1
            slug = "test"
            description = "Test"
            category = GroupCategory.ERROR.value
            category_v2 = GroupCategory.ERROR.value
            ignore_limit = 0

        @dataclass(frozen=True)
        class TestGroupType2(GroupType):
            type_id = 2
            slug = "hellboy"
            description = "Hellboy"
            category = GroupCategory.PERFORMANCE.value
            category_v2 = GroupCategory.DB_QUERY.value

        @dataclass(frozen=True)
        class TestGroupType3(GroupType):
            type_id = 3
            slug = "angelgirl"
            description = "AngelGirl"
            category = GroupCategory.PERFORMANCE.value
            category_v2 = GroupCategory.DB_QUERY.value

        assert get_group_types_by_category(GroupCategory.PERFORMANCE.value) == {2, 3}
        assert get_group_types_by_category(GroupCategory.ERROR.value) == {1}

    def test_get_group_type_by_slug(self) -> None:
        @dataclass(frozen=True)
        class TestGroupType(GroupType):
            type_id = 1
            slug = "test"
            description = "Test"
            category = GroupCategory.ERROR.value
            category_v2 = GroupCategory.ERROR.value
            ignore_limit = 0

        assert get_group_type_by_slug(TestGroupType.slug) == TestGroupType
        assert get_group_type_by_slug("meow") is None

    def test_category_validation(self) -> None:
        @dataclass(frozen=True)
        class TestGroupType(GroupType):
            type_id = 1
            slug = "error"
            description = "Error"
            category = 22
            category_v2 = 22

        with self.assertRaisesMessage(
            ValueError,
            f"Category must be one of {[category.value for category in GroupCategory]} from GroupCategory",
        ):
            TestGroupType(1, "error", "Error", 22, 22)

    def test_default_noise_config(self) -> None:
        @dataclass(frozen=True)
        class TestGroupType(GroupType):
            type_id = 1
            slug = "test"
            description = "Test"
            category = GroupCategory.ERROR.value
            category_v2 = GroupCategory.ERROR.value

        @dataclass(frozen=True)
        class TestGroupType2(GroupType):
            type_id = 2
            slug = "hellboy"
            description = "Hellboy"
            category = GroupCategory.PERFORMANCE.value
            category_v2 = GroupCategory.DB_QUERY.value
            noise_config = NoiseConfig()

        assert TestGroupType.noise_config is None
        assert TestGroupType2.noise_config == NoiseConfig()
        assert TestGroupType2.noise_config.ignore_limit == DEFAULT_IGNORE_LIMIT
        assert TestGroupType2.noise_config.expiry_time == DEFAULT_EXPIRY_TIME

    def test_noise_config(self) -> None:
        @dataclass(frozen=True)
        class TestGroupType(GroupType):
            type_id = 2
            slug = "hellboy"
            description = "Hellboy"
            category = GroupCategory.PERFORMANCE.value
            category_v2 = GroupCategory.DB_QUERY.value
            noise_config = NoiseConfig(ignore_limit=100, expiry_time=timedelta(hours=12))

        assert TestGroupType.noise_config.ignore_limit == 100
        assert TestGroupType.noise_config.expiry_time == timedelta(hours=12)


class GroupTypeReleasedTest(BaseGroupTypeTest):
    def test_released(self) -> None:
        @dataclass(frozen=True)
        class TestGroupType(GroupType):
            type_id = 1
            slug = "test"
            description = "Test"
            category = GroupCategory.PERFORMANCE.value
            category_v2 = GroupCategory.DB_QUERY.value
            noise_config = NoiseConfig()
            released = True

        assert TestGroupType.allow_post_process_group(self.organization)
        assert TestGroupType.allow_ingest(self.organization)

    def test_not_released(self) -> None:
        @dataclass(frozen=True)
        class TestGroupType(GroupType):
            type_id = 1
            slug = "test"
            description = "Test"
            category = GroupCategory.PERFORMANCE.value
            category_v2 = GroupCategory.DB_QUERY.value
            noise_config = NoiseConfig()
            released = False

        assert not TestGroupType.allow_post_process_group(self.organization)
        assert not TestGroupType.allow_ingest(self.organization)

    def test_not_released_features(self) -> None:
        @dataclass(frozen=True)
        class TestGroupType(GroupType):
            type_id = 1
            slug = "test"
            description = "Test"
            category = GroupCategory.PERFORMANCE.value
            category_v2 = GroupCategory.DB_QUERY.value
            noise_config = NoiseConfig()
            released = False

        with self.feature(TestGroupType.build_post_process_group_feature_name()):
            assert TestGroupType.allow_post_process_group(self.organization)
        with self.feature(TestGroupType.build_ingest_feature_name()):
            assert TestGroupType.allow_ingest(self.organization)


class GroupRegistryTest(BaseGroupTypeTest):
    def test_get_visible(self) -> None:
        class UnreleasedGroupType(GroupType):
            type_id = 9999
            slug = "unreleased_group_type"
            description = "Mock unreleased issue group"
            released = False
            category = GroupCategory.ERROR.value
            category_v2 = GroupCategory.ERROR.value

        registry = GroupTypeRegistry()
        registry.add(UnreleasedGroupType)
        assert registry.get_visible(self.organization) == []
        with self.feature(UnreleasedGroupType.build_visible_feature_name()):
            assert registry.get_visible(self.organization) == [UnreleasedGroupType]
        registry.add(ErrorGroupType)
        with self.feature(UnreleasedGroupType.build_visible_feature_name()):
            assert set(registry.get_visible(self.organization)) == {
                UnreleasedGroupType,
                ErrorGroupType,
            }

    def test_get_by_category(self) -> None:
        registry = GroupTypeRegistry()
        registry.add(ErrorGroupType)
        registry.add(PerformanceSlowDBQueryGroupType)
        registry.add(PerformanceNPlusOneGroupType)

        # Works for old category mapping
        assert registry.get_by_category(GroupCategory.ERROR.value) == {ErrorGroupType.type_id}
        assert registry.get_by_category(GroupCategory.PERFORMANCE.value) == {
            PerformanceSlowDBQueryGroupType.type_id,
            PerformanceNPlusOneGroupType.type_id,
        }

        # Works for new category mapping
        assert registry.get_by_category(GroupCategory.DB_QUERY.value) == {
            PerformanceSlowDBQueryGroupType.type_id,
            PerformanceNPlusOneGroupType.type_id,
        }
