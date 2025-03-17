import sentry_sdk
from django.core.exceptions import ValidationError
from rest_framework import serializers
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import EnvironmentMixin, region_silo_endpoint
from sentry.api.bases.organization import OrganizationDataExportPermission, OrganizationEndpoint
from sentry.api.serializers import serialize
from sentry.api.utils import get_date_range_from_params
from sentry.discover.arithmetic import categorize_columns
from sentry.exceptions import InvalidParams, InvalidSearchQuery
from sentry.models.environment import Environment
from sentry.models.organization import Organization
from sentry.search.events.builder.discover import DiscoverQueryBuilder
from sentry.search.events.builder.errors import ErrorsQueryBuilder
from sentry.search.events.types import QueryBuilderConfig
from sentry.snuba.dataset import Dataset
from sentry.snuba.errors import PARSER_CONFIG_OVERRIDES
from sentry.utils import metrics
from sentry.utils.snuba import MAX_FIELDS

from ..base import ExportQueryType
from ..models import ExportedData
from ..processors.discover import DiscoverProcessor
from ..tasks import assemble_download

# To support more datasets we may need to change the QueryBuilder being used
SUPPORTED_DATASETS = {
    "discover": Dataset.Discover,
    "issuePlatform": Dataset.IssuePlatform,
    "transactions": Dataset.Transactions,
    "errors": Dataset.Events,
}


class DataExportQuerySerializer(serializers.Serializer):
    query_type = serializers.ChoiceField(choices=ExportQueryType.as_str_choices(), required=True)
    query_info = serializers.JSONField(required=True)

    def validate(self, data):
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
        if data["query_type"] == ExportQueryType.DISCOVER_STR:
            # coerce the fields into a list as needed
            base_fields = query_info.get("field", [])
            if not isinstance(base_fields, list):
                base_fields = [base_fields]

            equations, fields = categorize_columns(base_fields)

            if len(base_fields) > MAX_FIELDS:
                detail = f"You can export up to {MAX_FIELDS} fields at a time. Please delete some and try again."
                raise serializers.ValidationError(detail)
            elif len(base_fields) == 0:
                raise serializers.ValidationError("at least one field is required to export")

            if "query" not in query_info:
                detail = "query is a required to export, please pass an empty string if you don't want to set one"
                raise serializers.ValidationError(detail)

            query_info["field"] = fields
            query_info["equations"] = equations

            if not query_info.get("project"):
                projects = self.context["get_projects"]()
                query_info["project"] = [project.id for project in projects]

            # make sure to fix the export start/end times to ensure consistent results
            try:
                start, end = get_date_range_from_params(query_info)
            except InvalidParams as e:
                sentry_sdk.set_tag("query.error_reason", "Invalid date params")
                raise serializers.ValidationError(str(e))

            if "statsPeriod" in query_info:
                del query_info["statsPeriod"]
            if "statsPeriodStart" in query_info:
                del query_info["statsPeriodStart"]
            if "statsPeriodEnd" in query_info:
                del query_info["statsPeriodEnd"]
            query_info["start"] = start.isoformat()
            query_info["end"] = end.isoformat()
            dataset = query_info.get("dataset", "discover")
            if dataset not in SUPPORTED_DATASETS:
                raise serializers.ValidationError(f"{dataset} is not supported for csv exports")

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
                    selected_columns=fields.copy(),
                    equations=equations,
                    config=config,
                )
                builder.get_snql_query()
            except InvalidSearchQuery as err:
                raise serializers.ValidationError(str(err))

        return data


@region_silo_endpoint
class DataExportEndpoint(OrganizationEndpoint, EnvironmentMixin):
    publish_status = {
        "POST": ApiPublishStatus.PRIVATE,
    }
    permission_classes = (OrganizationDataExportPermission,)

    def get_features(self, organization: Organization, request: Request) -> dict[str, bool | None]:
        feature_names = [
            "organizations:dashboards-mep",
            "organizations:mep-rollout-flag",
            "organizations:performance-use-metrics",
            "organizations:profiling",
            "organizations:dynamic-sampling",
            "organizations:use-metrics-layer",
            "organizations:starfish-view",
        ]
        batch_features = features.batch_has(
            feature_names,
            organization=organization,
            actor=request.user,
        )

        all_features = (
            batch_features.get(f"organization:{organization.id}", {})
            if batch_features is not None
            else {}
        )

        for feature_name in feature_names:
            if feature_name not in all_features:
                all_features[feature_name] = features.has(
                    feature_name, organization=organization, actor=request.user
                )

        return all_features

    def post(self, request: Request, organization) -> Response:
        """
        Create a new asynchronous file export task, and
        email user upon completion,
        """
        # The data export feature is only available alongside `discover-query`.
        # So to export issue tags, they must have have `discover-query`
        if not features.has("organizations:discover-query", organization):
            return Response(status=404)

        # Get environment_id and limit if available
        try:
            environment_id = self._get_environment_id_from_request(request, organization.id)
        except Environment.DoesNotExist as error:
            return Response(error, status=400)
        limit = request.data.get("limit")

        batch_features = self.get_features(organization, request)

        use_metrics = (
            (
                batch_features.get("organizations:mep-rollout-flag", False)
                and batch_features.get("organizations:dynamic-sampling", False)
            )
            or batch_features.get("organizations:performance-use-metrics", False)
            or batch_features.get("organizations:dashboards-mep", False)
        )

        # Validate the data export payload
        serializer = DataExportQuerySerializer(
            data=request.data,
            context={
                "organization": organization,
                "get_projects_by_id": lambda project_query: self.get_projects(
                    request=request, organization=organization, project_ids=project_query
                ),
                "get_projects": lambda: self.get_projects(request, organization),
                "has_metrics": use_metrics,
            },
        )
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)
        data = serializer.validated_data

        try:
            # If this user has sent a request with the same payload and organization,
            # we return them the latest one that is NOT complete (i.e. don't start another)
            query_type = ExportQueryType.from_str(data["query_type"])
            data_export, created = ExportedData.objects.get_or_create(
                organization=organization,
                user_id=request.user.id,
                query_type=query_type,
                query_info=data["query_info"],
                date_finished=None,
            )
            status = 200
            if created:
                metrics.incr(
                    "dataexport.enqueue", tags={"query_type": data["query_type"]}, sample_rate=1.0
                )
                assemble_download.delay(
                    data_export_id=data_export.id, export_limit=limit, environment_id=environment_id
                )
                status = 201
        except ValidationError as e:
            # This will handle invalid JSON requests
            metrics.incr(
                "dataexport.invalid", tags={"query_type": data.get("query_type")}, sample_rate=1.0
            )
            return Response({"detail": str(e)}, status=400)
        return Response(serialize(data_export, request.user), status=status)
