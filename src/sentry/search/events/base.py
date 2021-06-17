from typing import List, Optional, Set, Union

from django.utils.functional import cached_property
from snuba_sdk.column import Column
from snuba_sdk.function import CurriedFunction

from sentry.models import Project
from sentry.search.events.constants import SNQL_FIELD_ALLOWLIST
from sentry.search.events.types import ParamsType, SelectType, WhereType
from sentry.utils.snuba import Dataset, resolve_column


class QueryBase:
    field_allowlist = SNQL_FIELD_ALLOWLIST

    def __init__(
        self,
        dataset: Dataset,
        params: ParamsType,
        orderby: Optional[Union[List[str], str]] = None,
    ):
        # Function is a subclass of CurriedFunction
        self.aggregates: List[CurriedFunction] = []
        self.columns: List[SelectType] = []
        self.where: List[WhereType] = []

        self.params = params
        self.dataset = dataset
        if isinstance(orderby, str) and orderby != "":
            orderby = [orderby]
        self.orderby_columns: List[str] = orderby if orderby else []
        self.projects_to_filter: Set[int] = set()

        self.resolve_column_name = resolve_column(self.dataset)

    @cached_property
    def project_slugs(self):
        project_ids = self.params.get("project_id", [])

        if len(project_ids) > 0:
            project_slugs = Project.objects.filter(id__in=project_ids)
        else:
            project_slugs = []

        return {p.slug: p.id for p in project_slugs}

    def column(self, name: str) -> Column:
        return Column(self.resolve_column_name(name))
