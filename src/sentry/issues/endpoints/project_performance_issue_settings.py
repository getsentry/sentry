from enum import Enum

from rest_framework import serializers, status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import audit_log, features, projectoptions
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint, ProjectSettingPermission
from sentry.auth.superuser import superuser_has_permission
from sentry.issue_detection.performance_detection import get_merged_settings
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
    ProfileFunctionRegressionType,
    QueryInjectionVulnerabilityGroupType,
    WebVitalsGroup,
)

MAX_VALUE = 2147483647
TEN_SECONDS = 10000  # ten seconds in milliseconds
TEN_MB = 10000000  # ten MB in bytes
SETTINGS_PROJECT_OPTION_KEY = "sentry:performance_issue_settings"


class InternalProjectOptions(Enum):
    """
    Settings that are only accessible to superusers.
    """

    TRANSACTION_DURATION_REGRESSION = "transaction_duration_regression_detection_enabled"
    FUNCTION_DURATION_REGRESSION = "function_duration_regression_detection_enabled"


class ConfigurableThresholds(Enum):
    """
    All the settings that can be configured by users with the appropriate permissions.
    """

    N_PLUS_ONE_DB = "n_plus_one_db_queries_detection_enabled"
    N_PLUS_ONE_DB_DURATION = "n_plus_one_db_duration_threshold"
    N_PLUS_ONE_DB_COUNT = "n_plus_one_db_count"
    UNCOMPRESSED_ASSET = "uncompressed_assets_detection_enabled"
    UNCOMPRESSED_ASSET_DURATION = "uncompressed_asset_duration_threshold"
    UNCOMPRESSED_ASSET_SIZE = "uncompressed_asset_size_threshold"
    LARGE_HTTP_PAYLOAD = "large_http_payload_detection_enabled"
    LARGE_HTTP_PAYLOAD_SIZE = "large_http_payload_size_threshold"
    LARGE_HTTP_PAYLOAD_FILTERED_PATHS = "large_http_payload_filtered_paths"
    DB_ON_MAIN_THREAD = "db_on_main_thread_detection_enabled"
    DB_ON_MAIN_THREAD_DURATION = "db_on_main_thread_duration_threshold"
    FILE_IO_MAIN_THREAD = "file_io_on_main_thread_detection_enabled"
    FILE_IO_MAIN_THREAD_DURATION = "file_io_on_main_thread_duration_threshold"
    CONSECUTIVE_DB_QUERIES = "consecutive_db_queries_detection_enabled"
    CONSECUTIVE_DB_QUERIES_MIN_TIME_SAVED = "consecutive_db_min_time_saved_threshold"
    RENDER_BLOCKING_ASSET = "large_render_blocking_asset_detection_enabled"
    RENDER_BLOCKING_ASSET_FCP_RATIO = "render_blocking_fcp_ratio"
    SLOW_DB_QUERY = "slow_db_queries_detection_enabled"
    SLOW_DB_QUERY_DURATION = "slow_db_query_duration_threshold"
    N_PLUS_ONE_API_CALLS = "n_plus_one_api_calls_detection_enabled"
    N_PLUS_API_CALLS_DURATION = "n_plus_one_api_calls_total_duration_threshold"
    CONSECUTIVE_HTTP_SPANS = "consecutive_http_spans_detection_enabled"
    CONSECUTIVE_HTTP_SPANS_MIN_TIME_SAVED = "consecutive_http_spans_min_time_saved_threshold"
    HTTP_OVERHEAD = "http_overhead_detection_enabled"
    HTTP_OVERHEAD_REQUEST_DELAY = "http_request_delay_threshold"
    DB_QUERY_INJECTION = "db_query_injection_detection_enabled"
    SQL_INJECTION_QUERY_VALUE_LENGTH = "sql_injection_query_value_length_threshold"
    WEB_VITALS = "web_vitals_detection_enabled"
    WEB_VITALS_COUNT = "web_vitals_count"


project_settings_to_group_map: dict[str, type[GroupType]] = {
    ConfigurableThresholds.UNCOMPRESSED_ASSET.value: PerformanceUncompressedAssetsGroupType,
    ConfigurableThresholds.CONSECUTIVE_HTTP_SPANS.value: PerformanceConsecutiveHTTPQueriesGroupType,
    ConfigurableThresholds.LARGE_HTTP_PAYLOAD.value: PerformanceLargeHTTPPayloadGroupType,
    ConfigurableThresholds.N_PLUS_ONE_DB.value: PerformanceNPlusOneGroupType,
    ConfigurableThresholds.N_PLUS_ONE_API_CALLS.value: PerformanceNPlusOneAPICallsGroupType,
    ConfigurableThresholds.DB_ON_MAIN_THREAD.value: PerformanceDBMainThreadGroupType,
    ConfigurableThresholds.FILE_IO_MAIN_THREAD.value: PerformanceFileIOMainThreadGroupType,
    ConfigurableThresholds.CONSECUTIVE_DB_QUERIES.value: PerformanceConsecutiveDBQueriesGroupType,
    ConfigurableThresholds.RENDER_BLOCKING_ASSET.value: PerformanceRenderBlockingAssetSpanGroupType,
    ConfigurableThresholds.SLOW_DB_QUERY.value: PerformanceSlowDBQueryGroupType,
    ConfigurableThresholds.HTTP_OVERHEAD.value: PerformanceHTTPOverheadGroupType,
    InternalProjectOptions.TRANSACTION_DURATION_REGRESSION.value: PerformanceP95EndpointRegressionGroupType,
    InternalProjectOptions.FUNCTION_DURATION_REGRESSION.value: ProfileFunctionRegressionType,
    ConfigurableThresholds.DB_QUERY_INJECTION.value: QueryInjectionVulnerabilityGroupType,
    ConfigurableThresholds.WEB_VITALS.value: WebVitalsGroup,
}
"""
A mapping of the management settings to the group type that the detector spawns.
"""

thresholds_to_manage_map: dict[str, str] = {
    ConfigurableThresholds.N_PLUS_ONE_DB_DURATION.value: ConfigurableThresholds.N_PLUS_ONE_DB.value,
    ConfigurableThresholds.N_PLUS_ONE_DB_COUNT.value: ConfigurableThresholds.N_PLUS_ONE_DB.value,
    ConfigurableThresholds.UNCOMPRESSED_ASSET_DURATION.value: ConfigurableThresholds.UNCOMPRESSED_ASSET.value,
    ConfigurableThresholds.UNCOMPRESSED_ASSET_SIZE.value: ConfigurableThresholds.UNCOMPRESSED_ASSET.value,
    ConfigurableThresholds.LARGE_HTTP_PAYLOAD_SIZE.value: ConfigurableThresholds.LARGE_HTTP_PAYLOAD.value,
    ConfigurableThresholds.LARGE_HTTP_PAYLOAD_FILTERED_PATHS.value: ConfigurableThresholds.LARGE_HTTP_PAYLOAD.value,
    ConfigurableThresholds.DB_ON_MAIN_THREAD_DURATION.value: ConfigurableThresholds.DB_ON_MAIN_THREAD.value,
    ConfigurableThresholds.FILE_IO_MAIN_THREAD_DURATION.value: ConfigurableThresholds.FILE_IO_MAIN_THREAD.value,
    ConfigurableThresholds.CONSECUTIVE_DB_QUERIES_MIN_TIME_SAVED.value: ConfigurableThresholds.CONSECUTIVE_DB_QUERIES.value,
    ConfigurableThresholds.RENDER_BLOCKING_ASSET_FCP_RATIO.value: ConfigurableThresholds.RENDER_BLOCKING_ASSET.value,
    ConfigurableThresholds.SLOW_DB_QUERY_DURATION.value: ConfigurableThresholds.SLOW_DB_QUERY.value,
    ConfigurableThresholds.N_PLUS_API_CALLS_DURATION.value: ConfigurableThresholds.N_PLUS_ONE_API_CALLS.value,
    ConfigurableThresholds.CONSECUTIVE_HTTP_SPANS_MIN_TIME_SAVED.value: ConfigurableThresholds.CONSECUTIVE_HTTP_SPANS.value,
    ConfigurableThresholds.HTTP_OVERHEAD_REQUEST_DELAY.value: ConfigurableThresholds.HTTP_OVERHEAD.value,
    ConfigurableThresholds.SQL_INJECTION_QUERY_VALUE_LENGTH.value: ConfigurableThresholds.DB_QUERY_INJECTION.value,
    ConfigurableThresholds.WEB_VITALS_COUNT.value: ConfigurableThresholds.WEB_VITALS.value,
}
"""
A mapping of threshold setting to the parent setting that manages it's detection.
Used to determine if a threshold setting can be modified.
"""


class ProjectPerformanceIssueSettingsSerializer(serializers.Serializer):
    n_plus_one_db_duration_threshold = serializers.IntegerField(
        required=False, min_value=50, max_value=TEN_SECONDS
    )
    n_plus_one_db_count = serializers.IntegerField(required=False, min_value=5, max_value=100)
    slow_db_query_duration_threshold = serializers.IntegerField(
        required=False, min_value=100, max_value=TEN_SECONDS
    )
    render_blocking_fcp_ratio = serializers.FloatField(
        required=False, min_value=0.20, max_value=0.95
    )
    large_http_payload_size_threshold = serializers.IntegerField(
        required=False, min_value=100000, max_value=TEN_MB
    )
    large_http_payload_filtered_paths = serializers.CharField(
        required=False,
        allow_blank=True,
        max_length=1000,
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
    web_vitals_count = serializers.IntegerField(required=False, min_value=5, max_value=100)
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
    function_duration_regression_detection_enabled = serializers.BooleanField(required=False)
    db_query_injection_detection_enabled = serializers.BooleanField(required=False)
    web_vitals_detection_enabled = serializers.BooleanField(required=False)
    sql_injection_query_value_length_threshold = serializers.IntegerField(
        required=False, min_value=3, max_value=10
    )


def get_management_options() -> list[str]:
    """
    Returns the option keys that control whether a performance issue detector is enabled.
    """
    return [
        *[setting.value for setting in InternalProjectOptions],
        *list(thresholds_to_manage_map.values()),
    ]


def get_disabled_threshold_options(payload, current_settings):
    """
    Returns the option keys that are disabled, based on the current management settings.
    """
    options = []
    management_options = get_management_options()
    for option in payload:
        if option not in management_options:
            manage_detector_setting = thresholds_to_manage_map.get(option)
            is_threshold_enabled = current_settings.get(manage_detector_setting)
            if not is_threshold_enabled:
                options.append(option)
    return options


@region_silo_endpoint
class ProjectPerformanceIssueSettingsEndpoint(ProjectEndpoint):
    owner = ApiOwner.ISSUE_DETECTION_BACKEND
    publish_status = {
        "DELETE": ApiPublishStatus.PRIVATE,
        "GET": ApiPublishStatus.PRIVATE,
        "PUT": ApiPublishStatus.PRIVATE,
    }
    permission_classes = (ProjectSettingPermission,)

    def has_feature(self, project, request) -> bool:
        return features.has(
            "organizations:performance-view", project.organization, actor=request.user
        )

    def get(self, request: Request, project) -> Response:
        """
        Retrieve performance issue settings
        ``````````````````

        Return settings for performance issues

        :pparam string organization_id_or_slug: the id or slug of the organization the
                                          project belongs to.
        :pparam string project_id_or_slug: the id or slug of the project to configure.
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
        if body_has_admin_options and not superuser_has_permission(request):
            return Response(
                {
                    "detail": {
                        "message": "Passed options are only modifiable internally",
                        "code": "superuser-required",
                    },
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        body_has_management_options = any(
            [option in get_management_options() for option in request.data]
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

        if body_has_admin_options or body_has_management_options:
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
        management_options = get_management_options()
        threshold_options = [setting.value for setting in ConfigurableThresholds]
        disabled_options = get_disabled_threshold_options(threshold_options, project_settings)

        if project_settings:
            unchanged_options = (
                {  # Management settings and disabled threshold settings can not be reset
                    option: project_settings[option]
                    for option in project_settings
                    if option in management_options or option in disabled_options
                }
            )
            project.update_option(SETTINGS_PROJECT_OPTION_KEY, unchanged_options)

        return Response(status=status.HTTP_204_NO_CONTENT)
