import abc
from functools import reduce
from typing import Callable, List, Mapping, Optional

from snuba_sdk import Function, Op

from sentry.api.event_search import SearchFilter, SearchKey, SearchValue
from sentry.exceptions import InvalidSearchQuery
from sentry.models import Project
from sentry.search.events.constants import EQUALITY_OPERATORS
from sentry.search.events.fields import SnQLFunction
from sentry.search.events.filter import to_list
from sentry.search.events.types import SelectType, WhereType
from sentry.search.utils import parse_release


class DatasetConfig(abc.ABC):
    custom_threshold_columns = {}

    @property
    @abc.abstractmethod
    def search_filter_converter(
        self,
    ) -> Mapping[str, Callable[[SearchFilter], Optional[WhereType]]]:
        pass

    @property
    @abc.abstractmethod
    def field_alias_converter(self) -> Mapping[str, Callable[[str], SelectType]]:
        pass

    @property
    @abc.abstractmethod
    def function_converter(self) -> Mapping[str, SnQLFunction]:
        pass

    # Query Filters
    def _project_slug_filter_converter(self, search_filter: SearchFilter) -> Optional[WhereType]:
        """Convert project slugs to ids and create a filter based on those.
        This is cause we only store project ids in clickhouse.
        """
        value = search_filter.value.value

        if Op(search_filter.operator) == Op.EQ and value == "":
            raise InvalidSearchQuery(
                'Cannot query for has:project or project:"" as every event will have a project'
            )

        slugs = to_list(value)
        project_slugs: Mapping[str, int] = {
            slug: project_id
            for slug, project_id in self.builder.project_slugs.items()
            if slug in slugs
        }
        missing: List[str] = [slug for slug in slugs if slug not in project_slugs]
        if missing and search_filter.operator in EQUALITY_OPERATORS:
            raise InvalidSearchQuery(
                f"Invalid query. Project(s) {', '.join(missing)} do not exist or are not actively selected."
            )
        # Sorted for consistent query results
        project_ids = list(sorted(project_slugs.values()))
        if project_ids:
            # Create a new search filter with the correct values
            converted_filter = self.builder.convert_search_filter_to_condition(
                SearchFilter(
                    SearchKey("project.id"),
                    search_filter.operator,
                    SearchValue(project_ids if search_filter.is_in_filter else project_ids[0]),
                )
            )
            if converted_filter:
                if search_filter.operator in EQUALITY_OPERATORS:
                    self.builder.projects_to_filter.update(project_ids)
                return converted_filter

        return None

    def _release_filter_converter(self, search_filter: SearchFilter) -> Optional[WhereType]:
        """Parse releases for potential aliases like `latest`"""

        if search_filter.value.is_wildcard():
            operator = search_filter.operator
            value = search_filter.value
        else:
            operator_conversions = {"=": "IN", "!=": "NOT IN"}
            operator = operator_conversions.get(search_filter.operator, search_filter.operator)
            value = SearchValue(
                reduce(
                    lambda x, y: x + y,
                    [
                        parse_release(
                            v,
                            self.builder.params["project_id"],
                            self.builder.params.get("environment_objects"),
                            self.builder.params.get("organization_id"),
                        )
                        for v in to_list(search_filter.value.value)
                    ],
                    [],
                )
            )

        return self.builder._default_filter_converter(
            SearchFilter(search_filter.key, operator, value)
        )

    # Field Aliases
    def _resolve_project_slug_alias(self, alias: str) -> SelectType:
        project_ids = {
            project_id
            for project_id in self.builder.params.get("project_id", [])
            if isinstance(project_id, int)
        }

        # Try to reduce the size of the transform by using any existing conditions on projects
        # Do not optimize projects list if conditions contain OR operator
        if not self.builder.has_or_condition and len(self.builder.projects_to_filter) > 0:
            project_ids &= self.builder.projects_to_filter

        projects = Project.objects.filter(id__in=project_ids).values("slug", "id")

        return Function(
            "transform",
            [
                self.builder.column("project.id"),
                [project["id"] for project in projects],
                [project["slug"] for project in projects],
                "",
            ],
            alias,
        )
