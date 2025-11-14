import logging
from typing import Any, cast, int

from sentry.api.utils import get_date_range_from_params
from sentry.models.environment import Environment
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.search.eap.ourlogs.definitions import OURLOG_DEFINITIONS
from sentry.search.eap.resolver import SearchResolver
from sentry.search.eap.spans.definitions import SPAN_DEFINITIONS
from sentry.search.eap.types import EAPResponse, FieldsACL, SearchResolverConfig
from sentry.search.events.types import SAMPLING_MODES, SnubaParams
from sentry.snuba.ourlogs import OurLogs
from sentry.snuba.referrer import Referrer
from sentry.snuba.spans_rpc import Spans

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

        dataset: str = explore_query["dataset"]
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
        projects = list(
            Project.objects.filter(id__in=query.get("project"), organization_id=organization_id)
        )
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

    def run_query(self, offset: int, limit: int) -> list[dict[str, str]]:
        query: str = self.explore_query.get("query", "")
        fields: list[str] = self.explore_query.get(
            "field", []
        )  # Fixed: was "fields" should be "field"
        equations: list[str] = self.explore_query.get("equations", [])
        eap_response: EAPResponse = self.scoped_dataset.run_table_query(
            params=self.snuba_params,
            query_string=query,
            selected_columns=fields,
            equations=equations,
            offset=offset,
            orderby=self.explore_query.get("sort"),
            limit=limit,
            referrer=Referrer.DATA_EXPORT_TASKS_EXPLORE,
            config=self.config,
            sampling_mode=self.snuba_params.sampling_mode,
        )
        return eap_response["data"]
