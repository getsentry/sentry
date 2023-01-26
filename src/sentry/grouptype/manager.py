from dataclasses import dataclass

from sentry.event_manager import DEFAULT_GROUPHASH_IGNORE_LIMIT
from sentry.types.issues import GroupCategory

_group_type_registry = {}


@dataclass
class GroupType:
    type_id: int
    slug: str
    description: str
    category: int  # can I make this a list of options from GroupCategory.value?
    ignore_limit: int = DEFAULT_GROUPHASH_IGNORE_LIMIT  # how to init default arg?

    def __init__(self, type_id, slug, description, category, ignore_limit):
        self.type_id = type_id
        self.slug = slug
        self.description = description
        self.category = category
        self.ignore_limit = ignore_limit

    def __init_subclass__(cls, **kwargs):
        super().__init_subclass__(**kwargs)
        _group_type_registry[cls.__name__] = cls

    # def get_category_by_slug(self, slug: str):
    # 	return _group_type_registry[slug].category


class GroupTypeManager:
    def __init__(self) -> None:
        self._group_type_registry = {}

    def add(self, grouptype):
        self._group_type_registry[grouptype.slug] = grouptype

    def get_category_by_slug(self, slug: str):
        return self._group_type_registry[slug].category


GroupTypeManager().add(
    GroupType(
        type_id=1,
        slug="ERROR",
        description="Error",
        category=GroupCategory.ERROR.value,
        ignore_limit=DEFAULT_GROUPHASH_IGNORE_LIMIT,
    )
)

# class ErrorGroupType(GroupType):
# 	def __init__(self):
# 		super().__init__(type_id=1, slug="ERROR", description="Error", category=GroupCategory.ERROR.value, ignore_limit=DEFAULT_GROUPHASH_IGNORE_LIMIT)
