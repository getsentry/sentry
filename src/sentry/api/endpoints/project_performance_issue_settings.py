from enum import Enum
from typing import Dict, Type

from rest_framework import serializers, status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import audit_log, features, projectoptions
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint, ProjectSettingPermission
from sentry.api.permissions import SuperuserPermission
from sentry.auth.superuser import is_active_superuser
from sentry.issues.grouptype import (
    GroupType,
    PerformanceConsecutiveDBQueriesGroupType,
    PerformanceConsecutiveHTTPQueriesGroupType,
    PerformanceDBMainThreadGroupType,
    PerformanceFileIOMainThreadGroupType,
    PerformanceHTTPOverheadGroupType,
    PerformanceLargeHTTPPayloadGroupType,
    PerformanceNPlusOneAPICallsGroupType,
    PerformanceNPlusOneGroupType,
    PerformanceP95EndpointRegressionGroupType,
    PerformanceRenderBlockingAssetSpanGroupType,
    PerformanceSlowDBQueryGroupType,
    PerformanceUncompressedAssetsGroupType,
)
from sentry.utils.performance_issues.performance_detection import get_merged_settings

MAX_VALUE = 2147483647
TEN_SECONDS = 10000  # ten seconds in milliseconds
TEN_MB = 10000000  # ten MB in bytes
SETTINGS_PROJECT_OPTION_KEY = "sentry:performance_issue_settings"


# These options should only be accessible internally and used by
# support to enable/disable performance issue detection for an outlying project
# on a case-by-case basis.
class InternalProjectOptions(Enum):
    N_PLUS_ONE_DB = "n_plus_one_db_queries_detection_enabled"
    UNCOMPRESSED_ASSET = "uncompressed_assets_detection_enabled"
    CONSECUTIVE_HTTP_SPANS = "consecutive_http_spans_detection_enabled"
    LARGE_HTTP_PAYLOAD = "large_http_payload_detection_enabled"
    N_PLUS_ONE_API_CALLS = "n_plus_one_api_calls_detection_enabled"
    DB_ON_MAIN_THREAD = "db_on_main_thread_detection_enabled"
    FILE_IO_MAIN_THREAD = "file_io_on_main_thread_detection_enabled"
    CONSECUTIVE_DB_QUERIES = "consecutive_db_queries_detection_enabled"
    RENDER_BLOCKING_ASSET = "large_render_blocking_asset_detection_enabled"
    SLOW_DB_QUERY = "slow_db_queries_detection_enabled"
    HTTP_OVERHEAD = "http_overhead_detection_enabled"
    TRANSACTION_DURATION_REGRESSION = "transaction_duration_regression_detection_enabled"


class ConfigurableThresholds(Enum):
    N_PLUS_ONE_DB_DURATION = "n_plus_one_db_duration_threshold"
    UNCOMPRESSED_ASSET_DURATION = "uncompressed_asset_duration_threshold"
    UNCOMPRESSED_ASSET_SIZE = "uncompressed_asset_size_threshold"
    LARGE_HTTP_PAYLOAD_SIZE = "large_http_payload_size_threshold"
    DB_ON_MAIN_THREAD_DURATION = "db_on_main_thread_duration_threshold"
    FILE_IO_MAIN_THREAD_DURATION = "file_io_on_main_thread_duration_threshold"
    CONSECUTIVE_DB_QUERIES_MIN_TIME_SAVED = "consecutive_db_min_time_saved_threshold"
    RENDER_BLOCKING_ASSET_FCP_RATIO = "render_blocking_fcp_ratio"
    SLOW_DB_QUERY_DURATION = "slow_db_query_duration_threshold"
    N_PLUS_API_CALLS_DURATION = "n_plus_one_api_calls_total_duration_threshold"
    CONSECUTIVE_HTTP_SPANS_MIN_TIME_SAVED = "consecutive_http_spans_min_time_saved_threshold"
    HTTP_OVERHEAD_REQUEST_DELAY = "http_request_delay_threshold"


internal_only_project_settings_to_group_map: Dict[str, Type[GroupType]] = {
    InternalProjectOptions.UNCOMPRESSED_ASSET.value: PerformanceUncompressedAssetsGroupType,
    InternalProjectOptions.CONSECUTIVE_HTTP_SPANS.value: PerformanceConsecutiveHTTPQueriesGroupType,
    InternalProjectOptions.LARGE_HTTP_PAYLOAD.value: PerformanceLargeHTTPPayloadGroupType,
    InternalProjectOptions.N_PLUS_ONE_DB.value: PerformanceNPlusOneGroupType,
    InternalProjectOptions.N_PLUS_ONE_API_CALLS.value: PerformanceNPlusOneAPICallsGroupType,
    InternalProjectOptions.DB_ON_MAIN_THREAD.value: PerformanceDBMainThreadGroupType,
    InternalProjectOptions.FILE_IO_MAIN_THREAD.value: PerformanceFileIOMainThreadGroupType,
    InternalProjectOptions.CONSECUTIVE_DB_QUERIES.value: PerformanceConsecutiveDBQueriesGroupType,
    InternalProjectOptions.RENDER_BLOCKING_ASSET.value: PerformanceRenderBlockingAssetSpanGroupType,
    InternalProjectOptions.SLOW_DB_QUERY.value: PerformanceSlowDBQueryGroupType,
    InternalProjectOptions.HTTP_OVERHEAD.value: PerformanceHTTPOverheadGroupType,
    InternalProjectOptions.TRANSACTION_DURATION_REGRESSION.value: PerformanceP95EndpointRegressionGroupType,
}

configurable_thresholds_to_internal_settings_map: Dict[str, str] = {
    ConfigurableThresholds.N_PLUS_ONE_DB_DURATION.value: InternalProjectOptions.N_PLUS_ONE_DB.value,
    ConfigurableThresholds.UNCOMPRESSED_ASSET_DURATION.value: InternalProjectOptions.UNCOMPRESSED_ASSET.value,
    ConfigurableThresholds.UNCOMPRESSED_ASSET_SIZE.value: InternalProjectOptions.UNCOMPRESSED_ASSET.value,
    ConfigurableThresholds.LARGE_HTTP_PAYLOAD_SIZE.value: InternalProjectOptions.LARGE_HTTP_PAYLOAD.value,
    ConfigurableThresholds.DB_ON_MAIN_THREAD_DURATION.value: InternalProjectOptions.DB_ON_MAIN_THREAD.value,
    ConfigurableThresholds.FILE_IO_MAIN_THREAD_DURATION.value: InternalProjectOptions.FILE_IO_MAIN_THREAD.value,
    ConfigurableThresholds.CONSECUTIVE_DB_QUERIES_MIN_TIME_SAVED.value: InternalProjectOptions.CONSECUTIVE_DB_QUERIES.value,
    ConfigurableThresholds.RENDER_BLOCKING_ASSET_FCP_RATIO.value: InternalProjectOptions.RENDER_BLOCKING_ASSET.value,
    ConfigurableThresholds.SLOW_DB_QUERY_DURATION.value: InternalProjectOptions.SLOW_DB_QUERY.value,
    ConfigurableThresholds.N_PLUS_API_CALLS_DURATION.value: InternalProjectOptions.N_PLUS_ONE_API_CALLS.value,
    ConfigurableThresholds.CONSECUTIVE_HTTP_SPANS_MIN_TIME_SAVED.value: InternalProjectOptions.CONSECUTIVE_HTTP_SPANS.value,
    ConfigurableThresholds.HTTP_OVERHEAD_REQUEST_DELAY.value: InternalProjectOptions.HTTP_OVERHEAD.value,
}


class ProjectOwnerOrSuperUserPermissions(ProjectSettingPermission):
    def has_object_permission(self, request: Request, view, project):
        return super().has_object_permission(
            request, view, project
        ) or SuperuserPermission().has_permission(request, view)


class ProjectPerformanceIssueSettingsSerializer(serializers.Serializer):
    n_plus_one_db_duration_threshold = serializers.IntegerField(
        required=False, min_value=50, max_value=TEN_SECONDS
    )
    slow_db_query_duration_threshold = serializers.IntegerField(
        required=False, min_value=100, max_value=TEN_SECONDS
    )
    render_blocking_fcp_ratio = serializers.FloatField(
        required=False, min_value=0.20, max_value=0.95
    )
    large_http_payload_size_threshold = serializers.IntegerField(
        required=False, min_value=100000, max_value=TEN_MB
    )
    db_on_main_thread_duration_threshold = serializers.IntegerField(
        required=False, min_value=10, max_value=50
    )
    file_io_on_main_thread_duration_threshold = serializers.IntegerField(
        required=False, min_value=10, max_value=50
    )
    uncompressed_asset_duration_threshold = serializers.IntegerField(
        required=False, min_value=100, max_value=TEN_SECONDS
    )
    uncompressed_asset_size_threshold = serializers.IntegerField(
        required=False, min_value=100000, max_value=TEN_MB
    )
    consecutive_db_min_time_saved_threshold = serializers.IntegerField(
        required=False, min_value=50, max_value=5000  # ms
    )
    n_plus_one_api_calls_total_duration_threshold = serializers.IntegerField(
        required=False, min_value=100, max_value=TEN_SECONDS  # ms
    )
    consecutive_http_spans_min_time_saved_threshold = serializers.IntegerField(
        required=False, min_value=1000, max_value=TEN_SECONDS  # ms
    )
    http_request_delay_threshold = serializers.IntegerField(
        required=False, min_value=200, max_value=TEN_SECONDS  # ms
    )
    uncompressed_assets_detection_enabled = serializers.BooleanField(required=False)
    consecutive_http_spans_detection_enabled = serializers.BooleanField(required=False)
    large_http_payload_detection_enabled = serializers.BooleanField(required=False)
    n_plus_one_db_queries_detection_enabled = serializers.BooleanField(required=False)
    n_plus_one_api_calls_detection_enabled = serializers.BooleanField(required=False)
    db_on_main_thread_detection_enabled = serializers.BooleanField(required=False)
    file_io_on_main_thread_detection_enabled = serializers.BooleanField(required=False)
    consecutive_db_queries_detection_enabled = serializers.BooleanField(required=False)
    large_render_blocking_asset_detection_enabled = serializers.BooleanField(required=False)
    slow_db_queries_detection_enabled = serializers.BooleanField(required=False)
    http_overhead_detection_enabled = serializers.BooleanField(required=False)
    transaction_duration_regression_detection_enabled = serializers.BooleanField(required=False)


def get_disabled_threshold_options(payload, current_settings):
    options = []
    internal_only_settings = [setting.value for setting in InternalProjectOptions]
    for option in payload:
        if option not in internal_only_settings:
            internal_setting_for_option = configurable_thresholds_to_internal_settings_map.get(
                option
            )
            is_threshold_enabled = current_settings.get(internal_setting_for_option)
            if not is_threshold_enabled:
                options.append(option)
    return options


@region_silo_endpoint
class ProjectPerformanceIssueSettingsEndpoint(ProjectEndpoint):
    owner = ApiOwner.PERFORMANCE
    publish_status = {
        "DELETE": ApiPublishStatus.UNKNOWN,
        "GET": ApiPublishStatus.UNKNOWN,
        "PUT": ApiPublishStatus.UNKNOWN,
    }
    permission_classes = (ProjectOwnerOrSuperUserPermissions,)

    def has_feature(self, project, request) -> bool:
        return features.has(
            "organizations:performance-view", project.organization, actor=request.user
        )

    def get(self, request: Request, project) -> Response:
        """
        Retrieve performance issue settings
        ``````````````````

        Return settings for performance issues

        :pparam string organization_slug: the slug of the organization the
                                          project belongs to.
        :pparam string project_slug: the slug of the project to configure.
        :auth: required
        """

        if not self.has_feature(project, request):
            return self.respond(status=status.HTTP_404_NOT_FOUND)

        return Response(get_merged_settings(project))

    def put(self, request: Request, project) -> Response:
        if not self.has_feature(project, request):
            return self.respond(status=status.HTTP_404_NOT_FOUND)

        internal_only_settings = [setting.value for setting in InternalProjectOptions]
        threshold_settings = [setting.value for setting in ConfigurableThresholds]
        allowed_settings_options = [*internal_only_settings, *threshold_settings]

        body_has_invalid_options = not request.data or any(
            [option not in allowed_settings_options for option in request.data]
        )
        if body_has_invalid_options:
            return Response(
                {
                    "detail": "Invalid settings option",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        body_has_admin_options = any([option in request.data for option in internal_only_settings])
        if body_has_admin_options and not is_active_superuser(request):
            return Response(
                {
                    "detail": {
                        "message": "Passed options are only modifiable internally",
                        "code": "superuser-required",
                    },
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = ProjectPerformanceIssueSettingsSerializer(data=request.data)

        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        performance_issue_settings_default = projectoptions.get_well_known_default(
            SETTINGS_PROJECT_OPTION_KEY,
            project=project,
        )

        performance_issue_settings = project.get_option(
            SETTINGS_PROJECT_OPTION_KEY, default=performance_issue_settings_default
        )

        current_settings = {**performance_issue_settings_default, **performance_issue_settings}

        data = serializer.validated_data

        payload_contains_disabled_threshold_setting = any(
            [option in get_disabled_threshold_options(data, current_settings) for option in data]
        )
        if payload_contains_disabled_threshold_setting:
            return Response(
                {"detail": "Disabled options can not be modified"},
                status=status.HTTP_403_FORBIDDEN,
            )

        project.update_option(
            SETTINGS_PROJECT_OPTION_KEY,
            {**performance_issue_settings_default, **performance_issue_settings, **data},
        )

        if body_has_admin_options:
            self.create_audit_entry(
                request=self.request,
                actor=request.user,
                organization=project.organization,
                target_object=project.id,
                event=audit_log.get_event_id("PROJECT_PERFORMANCE_ISSUE_DETECTION_CHANGE"),
                data={**data, **project.get_audit_log_data()},
            )

        return Response(data)

    def delete(self, request: Request, project) -> Response:
        if not self.has_feature(project, request):
            return self.respond(status=status.HTTP_404_NOT_FOUND)

        project_settings = project.get_option(SETTINGS_PROJECT_OPTION_KEY, default={})
        threshold_options = [setting.value for setting in ConfigurableThresholds]
        internal_only_settings = [setting.value for setting in InternalProjectOptions]
        disabled_options = get_disabled_threshold_options(threshold_options, project_settings)

        if project_settings:
            unchanged_options = (
                {  # internal settings and disabled threshold settings can not be reset
                    option: project_settings[option]
                    for option in project_settings
                    if option in internal_only_settings or option in disabled_options
                }
            )
            project.update_option(SETTINGS_PROJECT_OPTION_KEY, unchanged_options)

        return Response(status=status.HTTP_204_NO_CONTENT)
