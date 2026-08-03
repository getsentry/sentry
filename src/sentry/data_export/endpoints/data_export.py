import logging
from typing import Any

import sentry_sdk
from django.core.exceptions import ValidationError
from rest_framework import serializers
from rest_framework.authentication import SessionAuthentication
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases.organization import OrganizationDataExportPermission, OrganizationEndpoint
from sentry.api.helpers.environments import get_environment_id
from sentry.api.serializers import serialize
from sentry.api.utils import get_date_range_from_params
from sentry.data_export.base import ExportError, ExportQueryType
from sentry.data_export.models import ExportedData
from sentry.data_export.processors.discover import DiscoverProcessor
from sentry.data_export.processors.explore import (
    SUPPORTED_TRACE_ITEM_DATASETS,
    ExploreProcessor,
)
from sentry.data_export.tasks import (
    assemble_download,
    export_data_to_stored_blobs_sync,
)
from sentry.data_export.writers import OutputMode
from sentry.discover.arithmetic import categorize_columns
from sentry.exceptions import InvalidParams, InvalidSearchQuery
from sentry.models.environment import Environment
from sentry.models.organization import Organization
from sentry.search.eap.constants import SAMPLING_MODE_MAP
from sentry.search.events.builder.discover import DiscoverQueryBuilder
from sentry.search.events.builder.errors import ErrorsQueryBuilder
from sentry.search.events.types import QueryBuilderConfig
from sentry.snuba import rpc_dataset_common
from sentry.snuba.dataset import Dataset
from sentry.snuba.errors import PARSER_CONFIG_OVERRIDES
from sentry.snuba.referrer import Referrer
from sentry.utils import metrics
from sentry.utils.snuba import MAX_FIELDS

# To support more datasets we may need to change the QueryBuilder being used
SUPPORTED_DATASETS = {
    "discover": Dataset.Discover,
    "issuePlatform": Dataset.IssuePlatform,
    "transactions": Dataset.Transactions,
    "errors": Dataset.Events,
}

logger = logging.getLogger(__name__)
MAX_EXPORT_LIMIT = 10_000
# Largest in-product (browser) export we assemble during the request so the user
# gets an immediate download link instead of an email. Keep in sync with
# ROW_COUNT_VALUE_SYNC_LIMIT in the frontend.
SYNC_EXPORT_ROW_LIMIT = 1_000


def is_api_or_agent_request(request: Request) -> bool:
    """
    True when the request did NOT come from a logged-in browser session.
    """
    return not isinstance(request.successful_authenticator, SessionAuthentication)


class DataExportQuerySerializer(serializers.Serializer[dict[str, Any]]):
    query_type = serializers.ChoiceField(choices=ExportQueryType.as_str_choices(), required=True)
    query_info = serializers.JSONField(required=True)
    format = serializers.ChoiceField(
        choices=OutputMode.supported_values(), required=False, default=OutputMode.CSV.value
    )
    limit = serializers.IntegerField(required=False, allow_null=True, min_value=1)

    def _validate_dataset(self, query_type: str, query_info: dict[str, Any]) -> dict[str, Any]:
        dataset = query_info.get("dataset")
        if query_type == ExportQueryType.DISCOVER_STR:
            dataset = dataset or "discover"
            if dataset not in SUPPORTED_DATASETS:
                raise serializers.ValidationError(f"{dataset} is not supported for exports")
        elif query_type in (
            ExportQueryType.EXPLORE_STR,
            ExportQueryType.TRACE_ITEM_FULL_EXPORT_STR,
        ):
            if not dataset:
                raise serializers.ValidationError(
                    f"Please specify dataset. Supported datasets for this query type are {str(SUPPORTED_TRACE_ITEM_DATASETS.keys())}."
                )

            if dataset not in SUPPORTED_TRACE_ITEM_DATASETS:
                raise serializers.ValidationError(f"{dataset} is not supported for exports")
        query_info["dataset"] = dataset
        return query_info

    def _validate_query_info(self, query_type: str, query_info: dict[str, Any]) -> dict[str, Any]:
        base_fields = query_info.get("field")
        if base_fields is None:
            base_fields = []
        elif not isinstance(base_fields, list):
            base_fields = [base_fields]

        is_jsonl_trace_item_full_export = query_type == ExportQueryType.TRACE_ITEM_FULL_EXPORT_STR
        if not is_jsonl_trace_item_full_export:
            if len(base_fields) > MAX_FIELDS:
                detail = f"You can export up to {MAX_FIELDS} fields at a time. Please delete some and try again."
                raise serializers.ValidationError(detail)
            elif len(base_fields) == 0:
                raise serializers.ValidationError("at least one field is required to export")

        if "query" not in query_info:
            if is_jsonl_trace_item_full_export:
                query_info["query"] = ""
            else:
                raise serializers.ValidationError(
                    "query is a required to export, please pass an empty string if you don't want to set one"
                )

        if len(base_fields) > 0:
            equations, fields = categorize_columns(base_fields)
            query_info["field"] = fields
            query_info["equations"] = equations
        else:
            query_info["field"] = []
            query_info["equations"] = []
        if not query_info.get("project"):
            projects = self.context["get_projects"]()
            query_info["project"] = [project.id for project in projects]

        # make sure to fix the export start/end times to ensure consistent results
        try:
            start, end = get_date_range_from_params(query_info)
        except InvalidParams as err:
            sentry_sdk.set_tag("query.error_reason", "Invalid date params")
            sentry_sdk.set_attribute("query.error_reason", "Invalid date params")
            sentry_sdk.capture_exception(err)
            raise serializers.ValidationError("Invalid date parameters.")

        if "statsPeriod" in query_info:
            del query_info["statsPeriod"]
        if "statsPeriodStart" in query_info:
            del query_info["statsPeriodStart"]
        if "statsPeriodEnd" in query_info:
            del query_info["statsPeriodEnd"]
        query_info["start"] = start.isoformat()
        query_info["end"] = end.isoformat()

        if (
            query_type == ExportQueryType.EXPLORE_STR
            or query_type == ExportQueryType.TRACE_ITEM_FULL_EXPORT_STR
        ):
            sort = query_info.get("sort", [])
            if sort and isinstance(sort, str):
                sort = [sort]
                query_info["sort"] = sort

            sampling_mode = query_info.get("sampling", None)
            if sampling_mode is not None:
                if sampling_mode.upper() not in SAMPLING_MODE_MAP:
                    raise serializers.ValidationError(
                        f"sampling mode: {sampling_mode} is not supported"
                    )
        return query_info

    def _validate_explore_eqs_query(
        self,
        organization: Organization,
        query_type: str,
        query_info: dict[str, Any],
        full_export: bool = False,
    ) -> dict[str, Any]:
        # Validate the RPC query params, to avoid runtime failures later.
        query_info = self._validate_query_info(query_type, query_info)
        query_info = self._validate_dataset(query_type, query_info)
        try:
            explore_processor = ExploreProcessor(
                explore_query=query_info,
                organization=organization,
            )

            # ignore sort clause if full export.
            sort = query_info.get("sort", []) if not full_export else []
            orderby = [sort] if isinstance(sort, str) else sort

            explore_processor.validate_export_query(
                rpc_dataset_common.TableQuery(
                    query_string=query_info["query"],
                    selected_columns=query_info["field"],
                    orderby=orderby,
                    offset=0,
                    limit=1,
                    referrer=Referrer.DATA_EXPORT_TASKS_EXPLORE,
                    sampling_mode=explore_processor.sampling_mode,
                    resolver=explore_processor.search_resolver,
                    equations=query_info.get("equations", []),
                )
            )
        except InvalidSearchQuery as err:
            sentry_sdk.capture_exception(err)
            raise serializers.ValidationError("Invalid table query.")
        return query_info

    def validate(self, data: dict[str, Any]) -> dict[str, Any]:
        organization = self.context["organization"]
        has_metrics = self.context["has_metrics"]
        query_info = data["query_info"]

        # Validate the project field, if provided
        # A PermissionDenied error will be raised in `get_projects_by_id` if the request is invalid
        project_query = query_info.get("project")
        if project_query:
            get_projects_by_id = self.context["get_projects_by_id"]
            # Coerce the query into a set
            if isinstance(project_query, list):
                projects = get_projects_by_id(set(map(int, project_query)))
            else:
                projects = get_projects_by_id({int(project_query)})
            query_info["project"] = [project.id for project in projects]

        # Discover Pre-processing
        query_type = data.get("query_type", "")
        query_info = data.get("query_info", {})
        export_format = data.get("format", OutputMode.CSV.value)

        if query_type == ExportQueryType.DISCOVER_STR:
            query_info = self._validate_query_info(query_type, query_info)
            query_info = self._validate_dataset(query_type, query_info)
            dataset = query_info["dataset"]

            # validate the query string by trying to parse it
            processor = DiscoverProcessor(
                discover_query=query_info,
                organization=organization,
            )
            try:
                query_builder_cls = DiscoverQueryBuilder
                config = QueryBuilderConfig(
                    auto_fields=True,
                    auto_aggregations=True,
                    has_metrics=has_metrics,
                )
                if dataset == "errors":
                    query_builder_cls = ErrorsQueryBuilder
                    config.parser_config_overrides = PARSER_CONFIG_OVERRIDES

                builder = query_builder_cls(
                    SUPPORTED_DATASETS[dataset],
                    params={},
                    snuba_params=processor.snuba_params,
                    query=query_info["query"],
                    selected_columns=query_info["field"].copy(),
                    equations=query_info.get("equations", []).copy(),
                    config=config,
                )
                builder.get_snql_query()
            except InvalidSearchQuery as err:
                sentry_sdk.capture_exception(err)
                raise serializers.ValidationError("Invalid search query.")

        elif query_type == ExportQueryType.EXPLORE_STR:
            query_info = self._validate_explore_eqs_query(organization, query_type, query_info)
        elif query_type == ExportQueryType.TRACE_ITEM_FULL_EXPORT_STR:
            query_info = self._validate_explore_eqs_query(
                organization, query_type, query_info, full_export=True
            )
            explore_output_mode = OutputMode.from_value(export_format)
            if explore_output_mode != OutputMode.JSONL:
                raise serializers.ValidationError("For full export, output mode must be JSONL.")

        elif data["query_type"] == ExportQueryType.ISSUES_BY_TAG_STR:
            issues_by_tag_validate(query_info)
        data["query_info"] = query_info
        return data


def issues_by_tag_validate(query_info: dict[str, Any]) -> None:
    group = query_info.get("group")
    if group is not None:
        try:
            query_info["group"] = int(group)
        except (ValueError, TypeError):
            raise serializers.ValidationError("Invalid group ID")


@cell_silo_endpoint
class DataExportEndpoint(OrganizationEndpoint):
    publish_status = {
        "POST": ApiPublishStatus.PRIVATE,
    }
    permission_classes = (OrganizationDataExportPermission,)

    def _get_project_id(self, request: Request) -> str:
        query_info: dict[str, Any] | None = None
        if request.data and hasattr(request.data, "post"):
            query_info = request.data.get("query_info", {})

        project_id = ""
        if query_info is not None and "project" in query_info:
            project_id = query_info["project"]
        return project_id

    def _parse_limit(self, data: dict[str, Any], is_api_request: bool) -> tuple[int | None, bool]:
        """
        Determine the export row limit and whether to run synchronously.

        Caller behavior:
          - API-token / agent requests (`is_api_request=True`): hard cap of
            ``MAX_EXPORT_LIMIT`` rows for every dataset. Unspecified or
            larger limits are clamped down. Larger self-serve exports were
            unreliable in practice; GDPR data-portability requests are
            handled out-of-band via sentry.io/contact/gdpr/.
          - Browser/session requests (`is_api_request=False`):
              - logs full export: hard cap of ``MAX_EXPORT_LIMIT`` (the
                sync download path is sized for this).
              - discover / explore (spans): no enforced cap; existing
                behavior is preserved to avoid regressing in-product exports.
                Exports at or below ``SYNC_EXPORT_ROW_LIMIT`` are assembled
                during the request so the user gets an immediate download
                link instead of an email; larger ones stay async.
        """
        limit = data.get("limit")

        if limit is not None:
            try:
                limit = int(limit)
            except (TypeError, ValueError):
                limit = None

        is_logs_full_export = (
            data["query_type"] == ExportQueryType.TRACE_ITEM_FULL_EXPORT_STR
            and data["query_info"].get("dataset") == "logs"
        )

        # Small in-product exports run synchronously so the user gets an
        # immediate download instead of an email, matching the logs path.
        is_small_browser_export = (
            not is_api_request
            and data["query_type"] in (ExportQueryType.DISCOVER_STR, ExportQueryType.EXPLORE_STR)
            and limit is not None
            and limit <= SYNC_EXPORT_ROW_LIMIT
        )

        run_sync = is_logs_full_export or is_small_browser_export

        if is_api_request or is_logs_full_export:
            if limit is None or limit > MAX_EXPORT_LIMIT:
                limit = MAX_EXPORT_LIMIT

        return limit, run_sync

    def post(self, request: Request, organization: Organization) -> Response:
        """
        Create a new asynchronous or sync file export task depending on requested file size,
        and email user upon completion.
        """

        extra = {
            "organization_id": organization.id,
            "project": self._get_project_id(request),
            "user": request.user,
        }
        logger.info("API Request started", extra=extra)

        # The data export feature is only available alongside `discover-query` (except for explore).
        # So to export issue tags, they must have have `discover-query`
        if not features.has("organizations:discover-query", organization):
            if request.data.get("query_type") not in {
                ExportQueryType.EXPLORE_STR,
                ExportQueryType.TRACE_ITEM_FULL_EXPORT_STR,
            }:
                return Response(status=404)

        # Get environment_id and limit if available
        try:
            environment_id = get_environment_id(request, organization.id)
        except Environment.DoesNotExist as error:
            return Response(error, status=400)

        # Validate the data export payload
        serializer = DataExportQuerySerializer(
            data=request.data,
            context={
                "organization": organization,
                "get_projects_by_id": lambda project_query: self.get_projects(
                    request=request, organization=organization, project_ids=project_query
                ),
                "get_projects": lambda: self.get_projects(request, organization),
                "has_metrics": True,
                "user": request.user,
            },
        )
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)
        validated_data = serializer.validated_data

        limit, run_sync = self._parse_limit(
            validated_data, is_api_request=is_api_or_agent_request(request)
        )

        try:
            # If this user has sent a request with the same payload and organization,
            # we return them the latest one that is NOT complete (i.e. don't start another)
            query_type = ExportQueryType.from_str(validated_data["query_type"])
            data_export, created = ExportedData.objects.get_or_create(
                organization=organization,
                user_id=request.user.id,
                query_type=query_type,
                query_info=validated_data["query_info"],
                date_finished=None,
                export_format=validated_data["format"],
            )
            status = 200
            if created:
                self._schedule_export_task(
                    data_export, environment_id, limit, validated_data, run_sync=run_sync
                )
                status = 201
            data_export.refresh_from_db()
            # This value can be used to find the schedule task in the GCP logs
            extra["data_export_id"] = data_export.id
            if status == 200:
                extra["status"] = "done"
            elif run_sync:
                extra["status"] = "export_data_to_stored_blobs_sync"
            else:
                extra["status"] = "assemble_download.task_scheduled"
        except ExportError:
            # For sync export HTTP response is the only way to signal failure.
            # Export can fail due to EAP timeouts or ratelimits.
            data_export.delete()
            return Response(
                {"detail": "Failed to export your data. Please try again."},
                status=500,
            )
        except ValidationError as e:
            # This will handle invalid JSON requests
            metrics.incr(
                "dataexport.invalid",
                tags={"query_type": validated_data.get("query_type")},
                sample_rate=1.0,
            )
            logger.exception("API Request failed", extra=extra)
            return Response({"detail": str(e)}, status=400)

        logger.info("API Request completed", extra=extra)
        return Response(serialize(data_export, request.user), status=status)

    def _schedule_export_task(
        self,
        data_export: ExportedData,
        environment_id: int | None,
        limit: int | None,
        validated_data: dict[str, Any],
        run_sync: bool = False,
    ) -> None:
        qi = validated_data["query_info"]
        export_format = validated_data["format"]
        dataset = qi.get("dataset")
        if run_sync:
            # `_parse_limit` guarantees a clamped int whenever run_sync is True.
            assert limit is not None
            export_data_to_stored_blobs_sync(
                data_export=data_export,
                export_limit=limit,
                environment_id=environment_id,
            )
        else:
            metrics.incr(
                "dataexport.enqueue",
                tags={
                    "query_type": validated_data["query_type"],
                    "format": export_format,
                    "dataset": str(dataset) if dataset is not None else "none",
                },
                sample_rate=1.0,
            )
            assemble_download.delay(
                data_export_id=data_export.id,
                export_limit=limit,
                environment_id=environment_id,
            )
