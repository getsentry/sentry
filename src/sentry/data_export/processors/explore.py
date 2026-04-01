import logging
from typing import Any, cast

from sentry import features
from sentry.api.endpoints.organization_trace_item_attributes import (
    POSSIBLE_ATTRIBUTE_TYPES,
    OrganizationTraceItemAttributesEndpoint,
    resolve_attribute_referrer,
)
from sentry.api.utils import get_date_range_from_params
from sentry.data_export.base import ExportError
from sentry.data_export.writers import OutputMode
from sentry.models.environment import Environment
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.search.eap import constants
from sentry.search.eap.ourlogs.definitions import OURLOG_DEFINITIONS
from sentry.search.eap.resolver import SearchResolver
from sentry.search.eap.spans.definitions import SPAN_DEFINITIONS
from sentry.search.eap.types import (
    EAPResponse,
    FieldsACL,
    SearchResolverConfig,
    SupportedTraceItemType,
)
from sentry.search.events.types import SAMPLING_MODES, SnubaParams
from sentry.snuba.ourlogs import OurLogs
from sentry.snuba.referrer import Referrer
from sentry.snuba.spans_rpc import Spans
from sentry.users.models import User

logger = logging.getLogger(__name__)

# Minimal columns for TableQuery validation when field list is deferred to task time.
_LOG_EXPORT_PROBE_COLUMNS = ["id", "trace", "project.id", "timestamp", "timestamp_precise"]

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

    def __init__(
        self,
        organization: Organization,
        explore_query: dict[str, Any],
        *,
        output_mode: OutputMode = OutputMode.CSV,
    ):
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
        if self.environments:
            self.snuba_params.environments = self.environments

        dataset: str = explore_query["dataset"]
        self.scoped_dataset = SUPPORTED_TRACE_ITEM_DATASETS[dataset]

        use_aggregate_conditions = explore_query.get("allowAggregateConditions", "1") == "1"
        disable_extrapolation = explore_query.get("disableAggregateExtrapolation", "0") == "1"

        if self.scoped_dataset == OurLogs:
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
        self.logs_full_detail_export = (
            output_mode == OutputMode.JSONL
            and dataset == "logs"
            and len(explore_query.get("field", [])) == 0
            and len(equations) == 0
        )
        self.header_fields = (
            [] if self.logs_full_detail_export else explore_query["field"]
        ) + equations

        self.explore_query = explore_query
        self._logs_wide_export_column_cache: list[str] | None = None

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

    def _get_attribute_keys_for_full_export(
        self,
        user: User,
        trace_item_type: SupportedTraceItemType,
    ) -> list[str]:
        """
        Collect every `key` from repeated calls to
        GET /api/0/organizations/{org}/trace-items/attributes/
        """
        referrer = resolve_attribute_referrer(trace_item_type.value)
        meta = self.resolver.resolve_meta(referrer=referrer.value)
        meta.trace_item_type = constants.SUPPORTED_TRACE_ITEM_TYPE_MAP[trace_item_type]
        use_sentry_conventions = features.has(
            "organizations:performance-sentry-conventions-fields",
            self.search_resolver.params.organization,
            actor=user,
        )
        helper = OrganizationTraceItemAttributesEndpoint()
        keys: set[str] = set()

        for attribute_type in POSSIBLE_ATTRIBUTE_TYPES:
            batch = helper.query_trace_attributes(
                0,
                1000,
                meta,
                query_filter=None,
                substring_match="",
                attribute_type=attribute_type,
                column_definitions=DEFINITIONS_MAP[self.scoped_dataset],
                use_sentry_conventions=use_sentry_conventions,
                trace_item_type=trace_item_type,
                include_internal=False,
            )
            if not batch:
                continue
            keys.update(item["key"] for item in batch)

        return sorted(keys)

    def run_query(self, offset: int, limit: int) -> list[dict[str, Any]]:
        query: str = self.explore_query.get("query", "")
        fields: list[str] = self.explore_query.get("field", [])
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

    def probe_columns_for_logs_wide_export_validation(self, user: User) -> list[str]:
        """Stable small column set for POST-time TableQuery validation only."""
        return self._get_attribute_keys_for_full_export(
            user=user, trace_item_type=SupportedTraceItemType.LOGS
        )
