from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass, field
from datetime import timedelta
from enum import Enum
from typing import TYPE_CHECKING, Any, Dict, List, Optional, Set, Type

from sentry import features
from sentry.features.base import OrganizationFeature
from sentry.utils import metrics

if TYPE_CHECKING:
    from sentry.models import Organization, Project, User


class GroupCategory(Enum):
    ERROR = 1
    PERFORMANCE = 2
    PROFILE = 3


GROUP_CATEGORIES_CUSTOM_EMAIL = (GroupCategory.ERROR, GroupCategory.PERFORMANCE)
# GroupCategories which have customized email templates. If not included here, will fall back to a generic template.

DEFAULT_IGNORE_LIMIT: int = 3
DEFAULT_EXPIRY_TIME: timedelta = timedelta(hours=24)


@dataclass()
class GroupTypeRegistry:
    _registry: Dict[int, Type[GroupType]] = field(default_factory=dict)
    _slug_lookup: Dict[str, Type[GroupType]] = field(default_factory=dict)
    _category_lookup: Dict[int, Set[int]] = field(default_factory=lambda: defaultdict(set))

    def add(self, group_type: Type[GroupType]) -> None:
        if self._registry.get(group_type.type_id):
            raise ValueError(
                f"A group type with the type_id {group_type.type_id} has already been registered."
            )
        self._registry[group_type.type_id] = group_type
        self._slug_lookup[group_type.slug] = group_type
        self._category_lookup[group_type.category].add(group_type.type_id)

    def all(self) -> List[Type[GroupType]]:
        return list(self._registry.values())

    def get_visible(
        self, organization: Organization, actor: Optional[Any] = None
    ) -> List[Type[GroupType]]:
        released = [gt for gt in self.all() if gt.released]
        feature_to_grouptype = {
            gt.build_visible_feature_name(): gt for gt in self.all() if not gt.released
        }
        batch_features = features.batch_has(
            list(feature_to_grouptype.keys()), actor=actor, organization=organization
        )
        enabled = []
        if batch_features:
            feature_results = batch_features.get(f"organization:{organization.id}", {})
            enabled = [
                feature_to_grouptype[feature]
                for feature, active in feature_results.items()
                if active
            ]
        return released + enabled

    def get_all_group_type_ids(self) -> Set[int]:
        return {type.type_id for type in self._registry.values()}

    def get_by_category(self, category: int) -> Set[int]:
        return self._category_lookup[category]

    def get_by_slug(self, slug: str) -> Optional[Type[GroupType]]:
        if slug not in self._slug_lookup:
            return None
        return self._slug_lookup[slug]

    def get_by_type_id(self, id_: int) -> Type[GroupType]:
        if id_ not in self._registry:
            raise ValueError(f"No group type with the id {id_} is registered.")
        return self._registry[id_]


registry = GroupTypeRegistry()


@dataclass(frozen=True)
class NoiseConfig:
    ignore_limit: int = DEFAULT_IGNORE_LIMIT
    expiry_time: timedelta = DEFAULT_EXPIRY_TIME

    @property
    def expiry_seconds(self) -> int:
        return int(self.expiry_time.total_seconds())


@dataclass(frozen=True)
class GroupType:

    type_id: int
    slug: str
    description: str
    category: int
    noise_config: Optional[NoiseConfig] = None
    # If True this group type should be released everywhere. If False, fall back to features to
    # decide if this is released.
    released: bool = False

    def __init_subclass__(cls: Type[GroupType], **kwargs: Any) -> None:
        super().__init_subclass__(**kwargs)
        registry.add(cls)

        if not cls.released:
            features.add(cls.build_visible_feature_name(), OrganizationFeature, True)
            features.add(cls.build_ingest_feature_name(), OrganizationFeature)
            features.add(cls.build_post_process_group_feature_name(), OrganizationFeature)

    def __post_init__(self) -> None:
        valid_categories = [category.value for category in GroupCategory]
        if self.category not in valid_categories:
            raise ValueError(f"Category must be one of {valid_categories} from GroupCategory.")

    @classmethod
    def is_visible(cls, organization: Organization, user: Optional[User] = None) -> bool:
        if cls.released:
            return True

        return features.has(cls.build_visible_feature_name(), organization, actor=user)

    @classmethod
    def allow_ingest(cls, organization: Organization) -> bool:
        if cls.released:
            return True

        return features.has(cls.build_ingest_feature_name(), organization)

    @classmethod
    def allow_post_process_group(cls, organization: Organization) -> bool:
        if cls.released:
            return True

        return features.has(cls.build_post_process_group_feature_name(), organization)

    @classmethod
    def build_feature_name_slug(cls) -> str:
        return cls.slug.replace("_", "-")

    @classmethod
    def build_base_feature_name(cls) -> str:
        return f"organizations:{cls.build_feature_name_slug()}"

    @classmethod
    def build_visible_feature_name(cls) -> str:
        return f"{cls.build_base_feature_name()}-visible"

    @classmethod
    def build_ingest_feature_name(cls) -> str:
        return f"{cls.build_base_feature_name()}-ingest"

    @classmethod
    def build_post_process_group_feature_name(cls) -> str:
        return f"{cls.build_base_feature_name()}-post-process-group"


def get_all_group_type_ids() -> Set[int]:
    # TODO: Replace uses of this with the registry
    return registry.get_all_group_type_ids()


def get_group_types_by_category(category: int) -> Set[int]:
    # TODO: Replace uses of this with the registry
    return registry.get_by_category(category)


def get_group_type_by_slug(slug: str) -> Optional[Type[GroupType]]:
    # TODO: Replace uses of this with the registry
    return registry.get_by_slug(slug)


def get_group_type_by_type_id(id: int) -> Type[GroupType]:
    # TODO: Replace uses of this with the registry
    return registry.get_by_type_id(id)


@dataclass(frozen=True)
class ErrorGroupType(GroupType):
    type_id = 1
    slug = "error"
    description = "Error"
    category = GroupCategory.ERROR.value
    released = True


# used as an additional superclass for Performance GroupType defaults
class PerformanceGroupTypeDefaults:
    noise_config = NoiseConfig()


@dataclass(frozen=True)
class PerformanceSlowDBQueryGroupType(PerformanceGroupTypeDefaults, GroupType):
    type_id = 1001
    slug = "performance_slow_db_query"
    description = "Slow DB Query"
    category = GroupCategory.PERFORMANCE.value
    noise_config = NoiseConfig(ignore_limit=100)


@dataclass(frozen=True)
class PerformanceRenderBlockingAssetSpanGroupType(PerformanceGroupTypeDefaults, GroupType):
    type_id = 1004
    slug = "performance_render_blocking_asset_span"
    description = "Large Render Blocking Asset"
    category = GroupCategory.PERFORMANCE.value


@dataclass(frozen=True)
class PerformanceNPlusOneGroupType(PerformanceGroupTypeDefaults, GroupType):
    type_id = 1006
    slug = "performance_n_plus_one_db_queries"
    description = "N+1 Query"
    category = GroupCategory.PERFORMANCE.value


@dataclass(frozen=True)
class PerformanceConsecutiveDBQueriesGroupType(PerformanceGroupTypeDefaults, GroupType):
    type_id = 1007
    slug = "performance_consecutive_db_queries"
    description = "Consecutive DB Queries"
    category = GroupCategory.PERFORMANCE.value
    noise_config = NoiseConfig(ignore_limit=15)


@dataclass(frozen=True)
class PerformanceFileIOMainThreadGroupType(PerformanceGroupTypeDefaults, GroupType):
    type_id = 1008
    slug = "performance_file_io_main_thread"
    description = "File IO on Main Thread"
    category = GroupCategory.PERFORMANCE.value


@dataclass(frozen=True)
class PerformanceConsecutiveHTTPQueriesGroupType(PerformanceGroupTypeDefaults, GroupType):
    type_id = 1009
    slug = "performance_consecutive_http"
    description = "Consecutive HTTP"
    category = GroupCategory.PERFORMANCE.value
    noise_config = NoiseConfig(ignore_limit=5)


@dataclass(frozen=True)
class PerformanceNPlusOneAPICallsGroupType(GroupType):
    type_id = 1010
    slug = "performance_n_plus_one_api_calls"
    description = "N+1 API Call"
    category = GroupCategory.PERFORMANCE.value


@dataclass(frozen=True)
class PerformanceMNPlusOneDBQueriesGroupType(PerformanceGroupTypeDefaults, GroupType):
    type_id = 1011
    slug = "performance_m_n_plus_one_db_queries"
    description = "MN+1 Query"
    category = GroupCategory.PERFORMANCE.value


@dataclass(frozen=True)
class PerformanceUncompressedAssetsGroupType(PerformanceGroupTypeDefaults, GroupType):
    type_id = 1012
    slug = "performance_uncompressed_assets"
    description = "Uncompressed Asset"
    category = GroupCategory.PERFORMANCE.value
    noise_config = NoiseConfig(ignore_limit=100)


@dataclass(frozen=True)
class PerformanceDBMainThreadGroupType(PerformanceGroupTypeDefaults, GroupType):
    type_id = 1013
    slug = "performance_db_main_thread"
    description = "DB on Main Thread"
    category = GroupCategory.PERFORMANCE.value


@dataclass(frozen=True)
class PerformanceLargeHTTPPayloadGroupType(PerformanceGroupTypeDefaults, GroupType):
    type_id = 1015
    slug = "performance_large_http_payload"
    description = "Large HTTP payload"
    category = GroupCategory.PERFORMANCE.value


@dataclass(frozen=True)
class ProfileFileIOGroupType(GroupType):
    type_id = 2001
    slug = "profile_file_io_main_thread"
    description = "File I/O on Main Thread"
    category = GroupCategory.PROFILE.value


@dataclass(frozen=True)
class ProfileImageDecodeGroupType(GroupType):
    type_id = 2002
    slug = "profile_image_decode_main_thread"
    description = "Image Decoding on Main Thread"
    category = GroupCategory.PROFILE.value


@dataclass(frozen=True)
class ProfileJSONDecodeType(GroupType):
    type_id = 2003
    slug = "profile_json_decode_main_thread"
    description = "JSON Decoding on Main Thread"
    category = GroupCategory.PROFILE.value


@metrics.wraps("noise_reduction.should_create_group", sample_rate=1.0)
def should_create_group(
    grouptype: Type[GroupType],
    client: Any,
    grouphash: str,
    project: Project,
) -> bool:
    key = f"grouphash:{grouphash}:{project.id}"
    times_seen = client.incr(key)
    noise_config = grouptype.noise_config

    if not noise_config:
        return True

    over_threshold = times_seen >= noise_config.ignore_limit

    metrics.incr(
        "noise_reduction.should_create_group.threshold",
        tags={
            "over_threshold": over_threshold,
            "group_type": grouptype.slug,
        },
        sample_rate=1.0,
    )

    if over_threshold:
        client.delete(grouphash)
        return True
    else:
        client.expire(key, noise_config.expiry_seconds)
        return False
