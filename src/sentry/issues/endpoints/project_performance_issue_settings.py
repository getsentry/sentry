from dataclasses import dataclass, field

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


@dataclass(frozen=True)
class DetectorConfig:
    enabled_key: str
    group_type: type[GroupType]
    thresholds: frozenset[str] = field(default_factory=frozenset)
    internal: bool = False  # if True, requires superuser to modify


DETECTORS: tuple[DetectorConfig, ...] = (
    DetectorConfig(
        enabled_key="n_plus_one_db_queries_detection_enabled",
        group_type=PerformanceNPlusOneGroupType,
        thresholds=frozenset({"n_plus_one_db_duration_threshold", "n_plus_one_db_count"}),
    ),
    DetectorConfig(
        enabled_key="uncompressed_assets_detection_enabled",
        group_type=PerformanceUncompressedAssetsGroupType,
        thresholds=frozenset(
            {"uncompressed_asset_duration_threshold", "uncompressed_asset_size_threshold"}
        ),
    ),
    DetectorConfig(
        enabled_key="large_http_payload_detection_enabled",
        group_type=PerformanceLargeHTTPPayloadGroupType,
        thresholds=frozenset(
            {"large_http_payload_size_threshold", "large_http_payload_filtered_paths"}
        ),
    ),
    DetectorConfig(
        enabled_key="db_on_main_thread_detection_enabled",
        group_type=PerformanceDBMainThreadGroupType,
        thresholds=frozenset({"db_on_main_thread_duration_threshold"}),
    ),
    DetectorConfig(
        enabled_key="file_io_on_main_thread_detection_enabled",
        group_type=PerformanceFileIOMainThreadGroupType,
        thresholds=frozenset({"file_io_on_main_thread_duration_threshold"}),
    ),
    DetectorConfig(
        enabled_key="consecutive_db_queries_detection_enabled",
        group_type=PerformanceConsecutiveDBQueriesGroupType,
        thresholds=frozenset({"consecutive_db_min_time_saved_threshold"}),
    ),
    DetectorConfig(
        enabled_key="large_render_blocking_asset_detection_enabled",
        group_type=PerformanceRenderBlockingAssetSpanGroupType,
        thresholds=frozenset({"render_blocking_fcp_ratio"}),
    ),
    DetectorConfig(
        enabled_key="slow_db_queries_detection_enabled",
        group_type=PerformanceSlowDBQueryGroupType,
        thresholds=frozenset({"slow_db_query_duration_threshold"}),
    ),
    DetectorConfig(
        enabled_key="n_plus_one_api_calls_detection_enabled",
        group_type=PerformanceNPlusOneAPICallsGroupType,
        thresholds=frozenset({"n_plus_one_api_calls_total_duration_threshold"}),
    ),
    DetectorConfig(
        enabled_key="consecutive_http_spans_detection_enabled",
        group_type=PerformanceConsecutiveHTTPQueriesGroupType,
        thresholds=frozenset({"consecutive_http_spans_min_time_saved_threshold"}),
    ),
    DetectorConfig(
        enabled_key="http_overhead_detection_enabled",
        group_type=PerformanceHTTPOverheadGroupType,
        thresholds=frozenset({"http_request_delay_threshold"}),
    ),
    DetectorConfig(
        enabled_key="db_query_injection_detection_enabled",
        group_type=QueryInjectionVulnerabilityGroupType,
        thresholds=frozenset({"sql_injection_query_value_length_threshold"}),
    ),
    DetectorConfig(
        enabled_key="web_vitals_detection_enabled",
        group_type=WebVitalsGroup,
        thresholds=frozenset({"web_vitals_count"}),
    ),
    DetectorConfig(
        enabled_key="transaction_duration_regression_detection_enabled",
        group_type=PerformanceP95EndpointRegressionGroupType,
        internal=True,
    ),
    DetectorConfig(
        enabled_key="function_duration_regression_detection_enabled",
        group_type=ProfileFunctionRegressionType,
        internal=True,
    ),
)

# Derived sets and maps — single source of truth is DETECTORS above
INTERNAL_ENABLED_KEYS: frozenset[str] = frozenset(d.enabled_key for d in DETECTORS if d.internal)
CONFIGURABLE_ENABLED_KEYS: frozenset[str] = frozenset(
    d.enabled_key for d in DETECTORS if not d.internal
)
ALL_ENABLED_KEYS: frozenset[str] = INTERNAL_ENABLED_KEYS | CONFIGURABLE_ENABLED_KEYS

THRESHOLD_TO_ENABLED: dict[str, str] = {t: d.enabled_key for d in DETECTORS for t in d.thresholds}
ALL_THRESHOLD_KEYS: frozenset[str] = frozenset(THRESHOLD_TO_ENABLED)
ALL_ALLOWED_KEYS: frozenset[str] = ALL_ENABLED_KEYS | ALL_THRESHOLD_KEYS

# Maps each enabled key to the GroupType its detector spawns; used for audit log rendering
ENABLED_KEY_TO_GROUP_TYPE: dict[str, type[GroupType]] = {
    d.enabled_key: d.group_type for d in DETECTORS
}

# Exported for external callers (e.g. statistical_detectors.py)
TRANSACTION_DURATION_REGRESSION_SETTING = "transaction_duration_regression_detection_enabled"
FUNCTION_DURATION_REGRESSION_SETTING = "function_duration_regression_detection_enabled"

# Import-time invariants
assert INTERNAL_ENABLED_KEYS.isdisjoint(CONFIGURABLE_ENABLED_KEYS)
assert ALL_THRESHOLD_KEYS.isdisjoint(ALL_ENABLED_KEYS), (
    "A key cannot serve as both an enabled key and a threshold"
)
assert ENABLED_KEY_TO_GROUP_TYPE.keys() == set(ALL_ENABLED_KEYS), (
    "Every detector must have a group type"
)
assert set(THRESHOLD_TO_ENABLED.values()) <= CONFIGURABLE_ENABLED_KEYS, (
    "Threshold parents must be configurable, not internal"
)


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
        required=False,
        min_value=50,
        max_value=5000,  # ms
    )
    n_plus_one_api_calls_total_duration_threshold = serializers.IntegerField(
        required=False,
        min_value=100,
        max_value=TEN_SECONDS,  # ms
    )
    consecutive_http_spans_min_time_saved_threshold = serializers.IntegerField(
        required=False,
        min_value=1000,
        max_value=TEN_SECONDS,  # ms
    )
    http_request_delay_threshold = serializers.IntegerField(
        required=False,
        min_value=200,
        max_value=TEN_SECONDS,  # ms
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


assert frozenset(ProjectPerformanceIssueSettingsSerializer._declared_fields) <= ALL_ALLOWED_KEYS, (
    "Serializer contains fields not present in DETECTORS"
)


def get_disabled_threshold_options(
    payload: object, current_settings: dict[str, object]
) -> list[str]:
    """
    Returns threshold keys from payload whose parent detector is currently disabled.
    """
    return [
        option
        for option in payload
        if option in ALL_THRESHOLD_KEYS and not current_settings.get(THRESHOLD_TO_ENABLED[option])
    ]


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

        if not request.data or any(option not in ALL_ALLOWED_KEYS for option in request.data):
            return Response(
                {"detail": "Invalid settings option"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if set(request.data) & INTERNAL_ENABLED_KEYS and not superuser_has_permission(request):
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

        if get_disabled_threshold_options(data, current_settings):
            return Response(
                {"detail": "Disabled options can not be modified"},
                status=status.HTTP_403_FORBIDDEN,
            )

        project.update_option(
            SETTINGS_PROJECT_OPTION_KEY,
            {**performance_issue_settings_default, **performance_issue_settings, **data},
        )

        if set(data) & ALL_ENABLED_KEYS:
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

        if project_settings:
            disabled_thresholds = set(
                get_disabled_threshold_options(ALL_THRESHOLD_KEYS, project_settings)
            )
            unchanged_options = {  # enabled keys and disabled thresholds are not reset
                option: project_settings[option]
                for option in project_settings
                if option in ALL_ENABLED_KEYS or option in disabled_thresholds
            }
            project.update_option(SETTINGS_PROJECT_OPTION_KEY, unchanged_options)

        return Response(status=status.HTTP_204_NO_CONTENT)
