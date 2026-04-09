import logging
from typing import Any

import sentry_sdk
from django.core.exceptions import ValidationError
from rest_framework import serializers
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases.organization import OrganizationDataExportPermission, OrganizationEndpoint
from sentry.api.helpers.environments import get_environment_id
from sentry.api.serializers import serialize
from sentry.api.utils import get_date_range_from_params
from sentry.data_export.base import ExportQueryType
from sentry.data_export.models import ExportedData
from sentry.data_export.processors.discover import DiscoverProcessor
from sentry.data_export.processors.explore import (
    SUPPORTED_TRACE_ITEM_DATASETS,
    ExploreProcessor,
)
from sentry.data_export.tasks import assemble_download
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


class DataExportQuerySerializer(serializers.Serializer[dict[str, Any]]):
    query_type = serializers.ChoiceField(choices=ExportQueryType.as_str_choices(), required=True)
    query_info = serializers.JSONField(required=True)
    format = serializers.ChoiceField(
        choices=OutputMode.supported_values(), required=False, default=OutputMode.CSV.value
    )

    def _validate_dataset(self, query_type: str, query_info: dict[str, Any]) -> dict[str, Any]:
        dataset = query_info.get("dataset")
        if query_type == ExportQueryType.DISCOVER_STR:
            dataset = dataset or "discover"
            if dataset not in SUPPORTED_DATASETS:
                raise serializers.ValidationError(f"{dataset} is not supported for exports")
        elif query_type == ExportQueryType.EXPLORE_STR:
            if not dataset:
                raise serializers.ValidationError(
                    f"Please specify dataset. Supported datasets for this query type are {str(SUPPORTED_TRACE_ITEM_DATASETS.keys())}."
                )

            if dataset not in SUPPORTED_TRACE_ITEM_DATASETS:
                raise serializers.ValidationError(f"{dataset} is not supported for exports")
        query_info["dataset"] = dataset
        return query_info

    def _validate_query_info(
        self, query_type: str, query_info: dict[str, Any], *, export_format: str
    ) -> dict[str, Any]:
        base_fields = query_info.get("field")
        if base_fields is None:
            base_fields = []
        elif not isinstance(base_fields, list):
            base_fields = [base_fields]

        is_jsonl_trace_item_full_export = (
            query_type == ExportQueryType.EXPLORE_STR
            and export_format == OutputMode.JSONL.value
            and len(base_fields) == 0
        )

        if len(base_fields) > MAX_FIELDS:
            detail = f"You can export up to {MAX_FIELDS} fields at a time. Please delete some and try again."
            raise serializers.ValidationError(detail)
        elif len(base_fields) == 0:
            if not is_jsonl_trace_item_full_export:
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

        if query_type == ExportQueryType.EXPLORE_STR:
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
            query_info = self._validate_query_info(
                query_type, query_info, export_format=export_format
            )
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
            query_info = self._validate_query_info(
                query_type, query_info, export_format=export_format
            )
            query_info = self._validate_dataset(query_type, query_info)
            explore_output_mode = OutputMode.from_value(export_format)
            is_full_jsonl_trace_item_export = (
                export_format == OutputMode.JSONL.value and len(query_info.get("field", [])) == 0
            )
            if not is_full_jsonl_trace_item_export:
                try:
                    explore_processor = ExploreProcessor(
                        explore_query=query_info,
                        organization=organization,
                        output_mode=explore_output_mode,
                    )
                    sort = query_info.get("sort", [])
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

        elif data["query_type"] == ExportQueryType.ISSUES_BY_TAG_STR:
            issues_by_tag_validate(query_info)
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

    def post(self, request: Request, organization: Organization) -> Response:
        """
        Create a new asynchronous file export task, and
        email user upon completion,
        """
        query_info: dict[str, Any] | None = None
        if request.data and hasattr(request.data, "post"):
            query_info = request.data.get("query_info", {})

        project_id = ""
        if query_info is not None and "project" in query_info:
            project_id = query_info["project"]

        extra = {
            "organization_id": organization.id,
            "project": project_id,
            "user": request.user,
        }
        logger.info("API Request started", extra=extra)

        # The data export feature is only available alongside `discover-query` (except for explore).
        # So to export issue tags, they must have have `discover-query`
        if not features.has("organizations:discover-query", organization):
            if request.data.get("query_type") != ExportQueryType.EXPLORE_STR:
                return Response(status=404)

        # Get environment_id and limit if available
        try:
            environment_id = get_environment_id(request, organization.id)
        except Environment.DoesNotExist as error:
            return Response(error, status=400)

        limit = None
        if request.data and hasattr(request.data, "get"):
            limit = request.data.get("limit")

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
                qi = validated_data["query_info"]
                export_format = validated_data["format"]
                dataset = qi.get("dataset")
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
                    data_export_id=data_export.id, export_limit=limit, environment_id=environment_id
                )
                status = 201
            # This value can be used to find the schedule task in the GCP logs
            extra["data_export_id"] = data_export.id
            extra["status"] = "done" if status == 200 else "assemble_download.task_scheduled"
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
