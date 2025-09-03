import logging
from typing import Any, cast

from sentry.api.utils import get_date_range_from_params
from sentry.models.environment import Environment
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.search.eap.types import FieldsACL
from sentry.search.events.types import SnubaParams
from sentry.snuba.ourlogs import OURLOG_DEFINITIONS, OurLogs
from sentry.snuba.referrer import Referrer
from sentry.snuba.rpc_dataset_common import SAMPLING_MODES, SearchResolver, SearchResolverConfig
from sentry.snuba.spans_rpc import SPAN_DEFINITIONS, Spans

from ..base import ExportError

logger = logging.getLogger(__name__)

SUPPORTED_TRACE_ITEM_DATASETS = {
    "spans": Spans,
    "logs": OurLogs,
}

DEFINITIONS_MAP = {
    Spans: SPAN_DEFINITIONS,
    OurLogs: OURLOG_DEFINITIONS,
}


class ExploreProcessor:
    """
    Processor for exports of discover data based on a provided query
    """

    def __init__(self, organization: Organization, explore_query: dict[str, Any]):
        self.projects = self.get_projects(organization.id, explore_query)
        self.environments = self.get_environments(organization.id, explore_query)
        self.start, self.end = get_date_range_from_params(explore_query)
        self.sampling_mode = self.get_sampling_mode(organization.id, explore_query)
        self.snuba_params = SnubaParams(
            organization=organization,
            projects=self.projects,
            start=self.start,
            end=self.end,
            sampling_mode=self.sampling_mode,
            query_string=explore_query.get("query"),
        )
        # make sure to only include environment if any are given
        # an empty list DOES NOT work
        if self.environments:
            self.snuba_params.environments = self.environments

        dataset = explore_query.get("dataset")
        self.scoped_dataset = SUPPORTED_TRACE_ITEM_DATASETS[dataset]

        use_aggregate_conditions = explore_query.get("allowAggregateConditions", "1") == "1"
        disable_extrapolation = explore_query.get("disableAggregateExtrapolation", "0") == "1"

        if self.scoped_dataset == OurLogs:
            # ourlogs doesn't have use aggregate conditions
            self.config = SearchResolverConfig(
                use_aggregate_conditions=False,
            )
        else:
            self.config = SearchResolverConfig(
                auto_fields=True,
                use_aggregate_conditions=use_aggregate_conditions,
                fields_acl=FieldsACL(functions={"time_spent_percentage"}),
                disable_aggregate_extrapolation=disable_extrapolation,
            )

        self.search_resolver = SearchResolver(
            params=self.snuba_params,
            config=self.config,
            definitions=DEFINITIONS_MAP[self.scoped_dataset],
        )

        equations = explore_query.get("equations", [])
        self.header_fields = explore_query["field"] + equations

        self.explore_query = explore_query

    @staticmethod
    def get_projects(organization_id: int, query: dict[str, Any]) -> list[Project]:
        projects = list(Project.objects.filter(id__in=query.get("project")))
        if len(projects) == 0:
            raise ExportError("Requested project does not exist")
        return projects

    @staticmethod
    def get_environments(organization_id: int, query: dict[str, Any]) -> list[Environment]:
        requested_environments = query.get("environment", [])
        if not isinstance(requested_environments, list):
            requested_environments = [requested_environments]

        if not requested_environments:
            return []

        environments = list(
            Environment.objects.filter(
                organization_id=organization_id, name__in=requested_environments
            )
        )
        environment_names = [e.name for e in environments]

        if set(requested_environments) != set(environment_names):
            raise ExportError("Requested environment does not exist")

        return environments

    @staticmethod
    def get_sampling_mode(organization_id: int, query: dict[str, Any]) -> SAMPLING_MODES | None:
        sampling_mode = query.get("sampling", None)
        if sampling_mode is not None:
            sampling_mode = cast(SAMPLING_MODES, sampling_mode.upper())
        return sampling_mode

    def run_query(self, offset: int, limit: int) -> dict[str, Any]:
        return self.scoped_dataset.run_table_query(
            params=self.snuba_params,
            query_string=self.explore_query.get("query"),
            selected_columns=self.explore_query.get("fields"),
            equations=self.explore_query.get("equations"),
            snuba_params=self.snuba_params,
            offset=offset,
            orderby=self.explore_query.get("sort"),
            limit=limit,
            referrer=Referrer.DATA_EXPORT_TASKS_EXPLORE,
            config=self.search_resolver,
            sampling_mode=self.snuba_params.sampling_mode,
        )
