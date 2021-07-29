from typing import List, Mapping, Optional, Set

from django.utils.functional import cached_property
from snuba_sdk.column import Column
from snuba_sdk.function import CurriedFunction, Function
from snuba_sdk.orderby import OrderBy

from sentry.models import Project
from sentry.search.events.constants import SNQL_FIELD_ALLOWLIST, TAG_KEY_RE
from sentry.search.events.types import ParamsType, SelectType, WhereType
from sentry.utils.snuba import Dataset, resolve_column


class QueryBase:
    field_allowlist = SNQL_FIELD_ALLOWLIST

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
        resolved_column = self.resolve_column_name(name)
        column = Column(resolved_column)

        if alias:
            # TODO(txiao): Remove this once column aliases are possible
            resolved_tag_match = TAG_KEY_RE.search(resolved_column)
            # if the alias is of the form `tags[...]` already,
            # do not use trick because it confuses snuba
            if resolved_tag_match and alias != resolved_column:
                column = Function("toString", [column], alias)

        return column
