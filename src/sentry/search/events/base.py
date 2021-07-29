from typing import List, Mapping, Optional, Set

from django.utils.functional import cached_property
from snuba_sdk.column import Column
from snuba_sdk.function import CurriedFunction, Function
from snuba_sdk.orderby import OrderBy

from sentry.models import Project
from sentry.search.events.constants import ARRAY_FIELDS, TAG_KEY_RE
from sentry.search.events.types import ParamsType, SelectType, WhereType
from sentry.utils.snuba import Dataset, resolve_column


class QueryBase:
    def __init__(self, dataset: Dataset, params: ParamsType):
        self.params = params
        self.dataset = dataset

        # Function is a subclass of CurriedFunction
        self.where: List[WhereType] = []
        self.aggregates: List[CurriedFunction] = []
        self.columns: List[SelectType] = []
        self.orderby: List[OrderBy] = []

        self.projects_to_filter: Set[int] = set()

        self.resolve_column_name = resolve_column(self.dataset)

    @cached_property
    def project_slugs(self) -> Mapping[str, int]:
        project_ids = self.params.get("project_id", [])

        if len(project_ids) > 0:
            project_slugs = Project.objects.filter(id__in=project_ids)
        else:
            project_slugs = []

        return {p.slug: p.id for p in project_slugs}

    def column(self, name: str, alias: Optional[str] = None) -> Column:
        """Given an unresolved sentry name and an optional expected alias,
        return a snql column that will be aliased to the expected alias if any.

        :param name: The unresolved sentry name.
        :param alias: The expected alias in the result.
        """
        resolved_column = self.resolve_column_name(name)

        if alias:
            return aliased_column(resolved_column, alias)

        return Column(resolved_column)


def aliased_column(resolved: str, alias: str) -> SelectType:
    """Given a resolved snuba name and an expected alias, return a snql column
    that will be aliased to the expected alias.

    This is temporary until the sdk has proper support for proper column aliases.

    :param resolved: The resolved snuba name.
    :param alias: The expected alias in the result.
    """
    column = Column(resolved)

    # If the expected alias is identical to the resolved snuba column,
    # no need to do this aliasing trick.
    # Additionally, tags of the form `tags[...]` can't be aliased again
    # because it confused the sdk.
    if alias == resolved:
        return column

    if alias in ARRAY_FIELDS:
        # since the array fields are already flattened, we can use
        # `arrayFlatten` to alias it
        return Function("arrayFlatten", [column], alias)

    if TAG_KEY_RE.search(resolved):
        # since tags are strings, we can use `toString` to alias it
        return Function("toString", [column], alias)

    # columns that are resolved into a snuba name are not supported
    raise NotImplementedError(f"{alias} not implemented in snql column resolution yet")
