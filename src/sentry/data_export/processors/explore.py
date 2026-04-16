import logging
from typing import Any, cast

from sentry_protos.snuba.v1.endpoint_trace_items_pb2 import (
    ExportTraceItemsRequest,
    ExportTraceItemsResponse,
)
from sentry_protos.snuba.v1.request_common_pb2 import PageToken, RequestMeta, TraceItemType

from sentry.api.utils import get_date_range_from_params
from sentry.data_export.base import ExportError
from sentry.data_export.utils import iter_export_trace_items_rows
from sentry.data_export.writers import OutputMode
from sentry.models.environment import Environment
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.search.eap.ourlogs.definitions import OURLOG_DEFINITIONS
from sentry.search.eap.resolver import SearchResolver
from sentry.search.eap.spans.definitions import SPAN_DEFINITIONS
from sentry.search.eap.types import (
    EAPResponse,
    FieldsACL,
    SearchResolverConfig,
)
from sentry.search.events.types import SAMPLING_MODES, SnubaParams
from sentry.snuba.ourlogs import OurLogs
from sentry.snuba.referrer import Referrer
from sentry.snuba.rpc_dataset_common import TableQuery
from sentry.snuba.spans_rpc import Spans
from sentry.utils.snuba_rpc import export_logs_rpc

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
        self.trace_item_type = (
            TraceItemType.TRACE_ITEM_TYPE_SPAN
            if dataset == "spans"
            else TraceItemType.TRACE_ITEM_TYPE_LOG
        )

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

    def validate_export_query(self, export_request: TableQuery) -> None:
        _ = self.scoped_dataset.get_table_rpc_request(export_request)


class TraceItemFullExportProcessor(ExploreProcessor):
    """Wide JSONL export: persists Snuba `EndpointExportTraceItems` page_token bytes between calls."""

    def __init__(
        self,
        organization: Organization,
        explore_query: dict[str, Any],
        *,
        output_mode: OutputMode = OutputMode.CSV,
        page_token: bytes | None = None,
        last_emitted_item_id_hex: str | None = None,
    ):
        super().__init__(organization, explore_query, output_mode=output_mode)
        self.page_token = page_token
        self._last_emitted_item_id_hex: str | None = last_emitted_item_id_hex

    @property
    def last_emitted_item_id_hex(self) -> str | None:
        return self._last_emitted_item_id_hex

    def _create_logs_export_rpc_meta(self) -> RequestMeta:
        if self.snuba_params.organization_id is None:
            raise ExportError("Organization ID must be provided")
        return RequestMeta(
            organization_id=self.snuba_params.organization_id,
            project_ids=self.snuba_params.project_ids,
            cogs_category="events_analytics_platform",
            start_timestamp=self.snuba_params.rpc_start_date,
            end_timestamp=self.snuba_params.rpc_end_date,
            referrer=Referrer.DATA_EXPORT_TASKS_EXPLORE,
            trace_item_type=self.trace_item_type,
        )

    def _sync_page_token_from_snuba_response(self, http_resp: ExportTraceItemsResponse) -> None:
        """Mirror Snuba's response page_token: continuation bytes or terminal (end_pagination)."""
        if not http_resp.HasField("page_token"):
            self.page_token = None
            return
        pt = http_resp.page_token
        if pt.HasField("end_pagination") and pt.end_pagination:
            self.page_token = None
        else:
            self.page_token = pt.SerializeToString()

    def run_query(self, _offset: int, limit: int) -> list[dict[str, Any]]:
        meta = self._create_logs_export_rpc_meta()
        request = ExportTraceItemsRequest(meta=meta, limit=limit)
        if self.page_token:
            token = PageToken()
            token.ParseFromString(self.page_token)
            request.page_token.CopyFrom(token)
        http_resp = export_logs_rpc(request)
        rows = list(iter_export_trace_items_rows(http_resp))

        if self._last_emitted_item_id_hex is not None:
            while rows and rows[0].get("item_id") == self._last_emitted_item_id_hex:
                rows = rows[1:]

        self._sync_page_token_from_snuba_response(http_resp)

        if not rows:
            return []

        last_id = rows[-1].get("item_id")
        if isinstance(last_id, str):
            self._last_emitted_item_id_hex = last_id
        return rows
