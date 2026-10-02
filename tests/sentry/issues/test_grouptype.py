from dataclasses import dataclass
from datetime import timedelta
from unittest.mock import patch
from uuid import uuid4

from sentry import features
from sentry.grouping.grouptype import ErrorGroupType
from sentry.issues.grouptype import (
    DEFAULT_EXPIRY_TIME,
    DEFAULT_IGNORE_LIMIT,
    AIDetectedCodeHealthGroupType,
    AIDetectedDBGroupType,
    AIDetectedHTTPGroupType,
    AIDetectedRuntimePerformanceGroupType,
    AIDetectedSecurityGroupType,
    GroupCategory,
    GroupType,
    GroupTypeRegistry,
    NoiseConfig,
    PerformanceNPlusOneGroupType,
    PerformanceSlowDBQueryGroupType,
    QueryInjectionVulnerabilityGroupType,
    get_group_type_by_slug,
    get_group_types_by_category,
    should_create_group,
)
from sentry.preprod.size_analysis.grouptype import PreprodSizeAnalysisGroupType
from sentry.testutils.cases import TestCase
from sentry.utils.redis import redis_clusters
from sentry.workflow_engine.registry import detector_settings_registry


class BaseGroupTypeTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.registry_patcher = patch("sentry.issues.grouptype.registry", new=GroupTypeRegistry())
        self.registry_patcher.__enter__()

        self.detector_settings_patcher = patch.dict(detector_settings_registry.registrations)
        self.detector_settings_patcher.__enter__()

        class ErrorGroupType(GroupType):
            type_id = -1
            slug = "error"
            description = "Error"
            category = GroupCategory.TEST_NOTIFICATION.value

        class IssueStreamGroupType(GroupType):
            type_id = 0
            slug = "issue_stream"
            description = "Issue Stream"
            category = GroupCategory.TEST_NOTIFICATION.value

    def tearDown(self) -> None:
        super().tearDown()
        self.detector_settings_patcher.__exit__(None, None, None)
        self.registry_patcher.__exit__(None, None, None)


class GroupTypeTest(BaseGroupTypeTest):
    def test_get_types_by_category(self) -> None:
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
            category = GroupCategory.DB_QUERY.value

        @dataclass(frozen=True)
        class TestGroupType3(GroupType):
            type_id = 3
            slug = "angelgirl"
            description = "AngelGirl"
            category = GroupCategory.DB_QUERY.value

        assert get_group_types_by_category(GroupCategory.DB_QUERY.value) == {2, 3}
        assert get_group_types_by_category(GroupCategory.ERROR.value) == {1}

    def test_get_group_type_by_slug(self) -> None:
        @dataclass(frozen=True)
        class TestGroupType(GroupType):
            type_id = 1
            slug = "test"
            description = "Test"
            category = GroupCategory.ERROR.value
            ignore_limit = 0

        assert get_group_type_by_slug(TestGroupType.slug) == TestGroupType
        assert get_group_type_by_slug("meow") is None

    def test_category_validation(self) -> None:
        with self.assertRaisesMessage(
            ValueError,
            f"Category must be one of {[category.value for category in GroupCategory]} from GroupCategory",
        ):

            class TestGroupType(GroupType):
                type_id = 1
                slug = "error"
                description = "Error"
                category = 22

    def test_default_noise_config(self) -> None:
        @dataclass(frozen=True)
        class TestGroupType(GroupType):
            type_id = 1
            slug = "test"
            description = "Test"
            category = GroupCategory.ERROR.value

        @dataclass(frozen=True)
        class TestGroupType2(GroupType):
            type_id = 2
            slug = "hellboy"
            description = "Hellboy"
            category = GroupCategory.DB_QUERY.value
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
            category = GroupCategory.DB_QUERY.value
            noise_config = NoiseConfig(ignore_limit=100, expiry_time=timedelta(hours=12))

        assert TestGroupType.noise_config.ignore_limit == 100
        assert TestGroupType.noise_config.expiry_time == timedelta(hours=12)


class ShouldCreateGroupTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.redis_client = redis_clusters.get("default")
        self.grouphash = uuid4().hex
        self.key = f"grouphash:{self.grouphash}:{self.project.id}"
        self.addCleanup(self.redis_client.delete, self.key)

    def test_no_noise_config_leaves_no_key(self) -> None:
        with patch.object(PerformanceSlowDBQueryGroupType, "noise_config", None):
            assert should_create_group(
                PerformanceSlowDBQueryGroupType, self.redis_client, self.grouphash, self.project
            )

        assert not self.redis_client.exists(self.key)

    def test_below_ignore_limit_key_expires(self) -> None:
        with patch.object(
            PerformanceSlowDBQueryGroupType, "noise_config", NoiseConfig(ignore_limit=2)
        ):
            assert not should_create_group(
                PerformanceSlowDBQueryGroupType, self.redis_client, self.grouphash, self.project
            )

        assert self.redis_client.ttl(self.key) > 0

    def test_at_ignore_limit_key_is_deleted(self) -> None:
        with patch.object(
            PerformanceSlowDBQueryGroupType, "noise_config", NoiseConfig(ignore_limit=2)
        ):
            assert not should_create_group(
                PerformanceSlowDBQueryGroupType, self.redis_client, self.grouphash, self.project
            )
            assert should_create_group(
                PerformanceSlowDBQueryGroupType, self.redis_client, self.grouphash, self.project
            )

        assert not self.redis_client.exists(self.key)


class GroupTypeReleasedTest(BaseGroupTypeTest):
    def test_completed_rollouts(self) -> None:
        registry = GroupTypeRegistry()
        group_types = {QueryInjectionVulnerabilityGroupType, PreprodSizeAnalysisGroupType}
        for group_type in group_types:
            registry.add(group_type)
            assert group_type.allow_ingest(self.organization)
            assert group_type.allow_post_process_group(self.organization)

        assert set(registry.get_visible(self.organization)) == group_types

    def test_released(self) -> None:
        @dataclass(frozen=True)
        class TestGroupType(GroupType):
            type_id = 1
            slug = "test"
            description = "Test"
            category = GroupCategory.DB_QUERY.value
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
            category = GroupCategory.DB_QUERY.value
            noise_config = NoiseConfig()
            released = False

        assert not TestGroupType.allow_post_process_group(self.organization)
        assert not TestGroupType.allow_ingest(self.organization)

    def test_backend_only_visibility(self) -> None:
        class BackendOnlyGroupType(GroupType):
            type_id = 1
            slug = "backend_only"
            description = "Backend-only issue"
            category = GroupCategory.DB_QUERY.value
            visible_feature_api_expose = False

        visible_flag = BackendOnlyGroupType.build_visible_feature_name()[0]
        assert visible_flag not in features.all(api_expose_only=True)

        registry = GroupTypeRegistry()
        registry.add(BackendOnlyGroupType)
        with self.feature(
            [
                visible_flag,
                BackendOnlyGroupType.build_ingest_feature_name(),
                BackendOnlyGroupType.build_post_process_group_feature_name(),
            ]
        ):
            assert registry.get_visible(self.organization) == [BackendOnlyGroupType]
            assert BackendOnlyGroupType.allow_ingest(self.organization)
            assert BackendOnlyGroupType.allow_post_process_group(self.organization)

    def test_not_released_features(self) -> None:
        @dataclass(frozen=True)
        class TestGroupType(GroupType):
            type_id = 1
            slug = "test"
            description = "Test"
            category = GroupCategory.DB_QUERY.value
            noise_config = NoiseConfig()
            released = False

        with self.feature(TestGroupType.build_post_process_group_feature_name()):
            assert TestGroupType.allow_post_process_group(self.organization)
        with self.feature(TestGroupType.build_ingest_feature_name()):
            assert TestGroupType.allow_ingest(self.organization)


class GroupRegistryTest(BaseGroupTypeTest):
    def test_shared_ai_rollout_features(self) -> None:
        registry = GroupTypeRegistry()
        group_types = {
            AIDetectedHTTPGroupType,
            AIDetectedDBGroupType,
            AIDetectedRuntimePerformanceGroupType,
            AIDetectedSecurityGroupType,
            AIDetectedCodeHealthGroupType,
        }
        for group_type in group_types:
            registry.add(group_type)

        with self.feature(
            {
                "organizations:issue-ai-detected-visible": False,
                "organizations:issue-ai-detected-ingest": False,
                "organizations:issue-ai-detected-post-process-group": False,
            }
        ):
            assert registry.get_visible(self.organization) == []
            for group_type in group_types:
                assert not group_type.allow_ingest(self.organization)
                assert not group_type.allow_post_process_group(self.organization)

        with self.feature(
            [
                "organizations:issue-ai-detected-visible",
                "organizations:issue-ai-detected-ingest",
                "organizations:issue-ai-detected-post-process-group",
            ]
        ):
            assert set(registry.get_visible(self.organization)) == group_types
            for group_type in group_types:
                assert group_type.allow_ingest(self.organization)
                assert group_type.allow_post_process_group(self.organization)

    def test_get_visible(self) -> None:
        class UnreleasedGroupType(GroupType):
            type_id = 9999
            slug = "unreleased_group_type"
            description = "Mock unreleased issue group"
            released = False
            category = GroupCategory.ERROR.value

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

        assert registry.get_by_category(GroupCategory.ERROR.value) == {ErrorGroupType.type_id}
        assert registry.get_by_category(GroupCategory.DB_QUERY.value) == {
            PerformanceSlowDBQueryGroupType.type_id,
            PerformanceNPlusOneGroupType.type_id,
        }
