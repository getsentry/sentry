from collections import defaultdict
from datetime import datetime, timedelta
from enum import Enum
from typing import Any, Dict, Mapping, Optional, Set, Tuple

import pytz
import sentry_sdk
from django.db.models import Q

from sentry.dynamic_sampling import get_redis_client_for_ds
from sentry.incidents.models import AlertRule
from sentry.models import DashboardWidgetQuery, Organization, Project
from sentry.snuba import metrics_performance
from sentry.snuba.discover import query as discover_query
from sentry.snuba.metrics_enhanced_performance import query as performance_query
from sentry.tasks.base import instrumented_task
from sentry.utils import json

# The time range over which the check script queries the data for determining the compatibility state.
QUERY_TIME_RANGE_IN_DAYS = 1

# List of minimum SDK versions that support Performance at Scale.
# The list is defined here:
# https://docs.sentry.io/product/performance/performance-at-scale/getting-started
SUPPORTED_SDK_VERSIONS = {
    # Python
    "sentry-python": "1.7.2",
    "sentry.python.tornado": "1.7.2",
    "sentry.python.starlette": "1.7.2",
    "sentry.python.flask": "1.7.2",
    "sentry.python.fastapi": "1.7.2",
    "sentry.python.falcon": "1.7.2",
    "sentry.python.django": "1.7.2",
    "sentry.python.bottle": "1.7.2",
    "sentry.python.aws_lambda": "1.7.2",
    "sentry.python.aiohttp": "1.7.2",
    "sentry.python": "1.7.2",
    # JavaScript
    "sentry-browser": "7.6.0",
    "sentry.javascript.angular": "7.6.0",
    "sentry.javascript.browser": "7.6.0",
    "sentry.javascript.ember": "7.6.0",
    "sentry.javascript.gatsby": "7.6.0",
    "sentry.javascript.nextjs": "7.6.0",
    "sentry.javascript.react": "7.6.0",
    "sentry.javascript.remix": "7.6.0",
    "sentry.javascript.serverless": "7.6.0",
    "sentry.javascript.svelte": "7.6.0",
    "sentry.javascript.vue": "7.6.0",
    "sentry.javascript.node": "7.6.0",
    "sentry.javascript.angular-ivy": "7.6.0",
    "sentry.javascript.sveltekit": "7.6.0",
    # Apple
    "sentry-cocoa": "7.23.0",
    "sentry-objc": "7.23.0",
    "sentry-swift": "7.23.0",
    "sentry.cocoa": "7.18.0",
    "sentry.swift": "7.23.0",
    "SentrySwift": "7.23.0",
    # Android
    "sentry-android": "6.5.0",
    "sentry.java.android.timber": "6.5.0",
    "sentry.java.android": "6.5.0",
    "sentry.native.android": "6.5.0",
    # React Native
    "sentry-react-native": "4.3.0",
    "sentry.cocoa.react-native": "4.3.0",
    "sentry.java.android.react-native": "4.3.0",
    "sentry.javascript.react-native": "4.3.0",
    "sentry.native.android.react-native": "4.3.0",
    "sentry.javascript.react-native.expo": "6.0.0",
    "sentry.javascript.react.expo": "6.0.0",
    # Dart and Flutter
    "dart": "6.11.0",
    "dart-sentry-client": "6.11.0",
    "sentry.dart": "6.11.0",
    "sentry.dart.logging": "6.11.0",
    "sentry.cocoa.flutter": "6.11.0",
    "sentry.dart.flutter": "6.11.0",
    "sentry.java.android.flutter": "6.11.0",
    "sentry.native.android.flutter": "6.11.0",
    "sentry.dart.browser": "6.11.0",
    # PHP
    "sentry-php": "3.9.0",
    "sentry.php": "3.9.0",
    # Laravel
    "sentry-laravel": "3.0.0",
    "sentry.php.laravel": "3.0.0",
    # Symfony
    "sentry-symfony": "4.4.0",
    "sentry.php.symfony": "4.4.0",
    "Symphony.SentryClient": "4.4.0",
    # Ruby
    "sentry-ruby": "5.5.0",
    "sentry.ruby": "5.5.0",
    "sentry.ruby.delayed_job": "5.5.0",
    "sentry.ruby.rails": "5.5.0",
    "sentry.ruby.resque": "5.5.0",
    "sentry.ruby.sidekiq": "5.5.0",
    # Java
    "sentry-java": "6.5.0",
    "sentry.java": "6.5.0",
    "sentry.java.jul": "6.5.0",
    "sentry.java.log4j2": "6.5.0",
    "sentry.java.logback": "6.5.0",
    "sentry.java.spring": "6.5.0",
    "sentry.java.spring-boot": "6.5.0",
    "sentry.java.spring-boot.jakarta": "6.5.0",
    "sentry.java.spring.jakarta": "6.5.0",
    # .NET
    "sentry.aspnetcore": "3.22.0",
    "Sentry.AspNetCore": "3.22.0",
    "sentry.dotnet": "3.22.0",
    "sentry.dotnet.android": "3.22.0",
    "sentry.dotnet.aspnet": "3.22.0",
    "sentry.dotnet.aspnetcore": "3.22.0",
    "sentry.dotnet.aspnetcore.grpc": "3.22.0",
    "sentry.dotnet.atlasproper": "3.22.0",
    "sentry.dotnet.cocoa": "3.22.0",
    "sentry.dotnet.ef": "3.22.0",
    "sentry.dotnet.extensions.logging": "3.22.0",
    "sentry.dotnet.google-cloud-function": "3.22.0",
    "sentry.dotnet.log4net": "3.22.0",
    "sentry.dotnet.maui": "3.22.0",
    "sentry.dotnet.nlog": "3.22.0",
    "sentry.dotnet.serilog": "3.22.0",
    "sentry.dotnet.xamarin": "3.22.0",
    "sentry.dotnet.xamarin-forms": "3.22.0",
    "Sentry.Extensions.Logging": "3.22.0",
    "Sentry.NET": "3.22.0",
    "Sentry.UWP": "3.22.0",
    "SentryDotNet": "3.22.0",
    "SentryDotNet.AspNetCore": "3.22.0",
    # Unity
    "sentry.dotnet.unity": "0.24.0",
    "sentry.cocoa.unity": "0.24.0",
    "sentry.java.android.unity": "0.24.0",
    # Go
    "sentry.go": "0.16.0",
}

TASK_SOFT_LIMIT_IN_SECONDS = 30 * 60  # 30 minutes
ONE_MINUTE_TTL = 60  # 1 minute

# Conditions that are excluded from the widgets query.
EXCLUDED_CONDITIONS = [
    # Match specific tags with values.
    "event.type:error",
    "!event.type:transaction",
    "event.type:csp",
    "event.type:default",
    # Match specific tags.
    "handled:",
    "unhandled:",
    "culprit:",
    "issue:",
    "level:",
    "unreal.crash_type:",
    # Match multiple tags that contain this.
    "stack.",
    "error.",
    # Match generic values.
    "issue",
    "exception",
]


class CheckStatus(Enum):
    ERROR = 0
    IN_PROGRESS = 1
    DONE = 2


class CheckAM2Compatibility:
    @classmethod
    def get_widget_url(cls, org_slug, dashboard_id, widget_id):
        return f"https://{org_slug}.sentry.io/organizations/{org_slug}/dashboard/{dashboard_id}/widget/{widget_id}/"

    @classmethod
    def get_alert_url(cls, org_slug, alert_id):
        return f"https://{org_slug}.sentry.io/organizations/{org_slug}/alerts/rules/details/{alert_id}/"

    @classmethod
    def get_found_sdks_url(cls, org_slug):
        return (
            f"https://{org_slug}.sentry.io/organizations/{org_slug}/discover/homepage/?field=sdk.version&field=sdk"
            f".name&field=project&field"
            f"=count%28%29"
        )

    @classmethod
    def compare_versions(cls, version1, version2):
        # Split the version strings into individual numbers
        nums1 = version1.split(".")
        nums2 = version2.split(".")

        # Pad the shorter version with zeros to ensure equal length
        length = max(len(nums1), len(nums2))
        nums1 = (["0"] * (length - len(nums1))) + nums1
        nums2 = (["0"] * (length - len(nums2))) + nums2

        # Compare the numbers from left to right
        for num1, num2 in zip(nums1, nums2):
            if int(num1) > int(num2):
                return 1
            elif int(num1) < int(num2):
                return -1

        # All numbers are equal
        return 0

    @classmethod
    def format_results(
        cls,
        organization,
        projects_compatibility,
        unsupported_widgets,
        unsupported_alerts,
        outdated_sdks_per_project,
    ):
        results: Dict[str, Any] = {"projects_compatibility": projects_compatibility}

        widgets = []
        for dashboard_id, unsupported_widgets in unsupported_widgets.items():
            unsupported = []
            for widget_id, fields, conditions in unsupported_widgets:
                unsupported.append(
                    {
                        "id": widget_id,
                        "url": cls.get_widget_url(organization.slug, dashboard_id, widget_id),
                        "fields": fields,
                        "conditions": conditions,
                    }
                )

            widgets.append({"dashboard_id": dashboard_id, "unsupported": unsupported})

        results["widgets"] = widgets

        alerts = []
        for alert_id, aggregate, query in unsupported_alerts:
            alerts.append(
                {
                    "id": alert_id,
                    "url": cls.get_alert_url(organization.slug, alert_id),
                    "aggregate": aggregate,
                    "query": query,
                }
            )
        results["alerts"] = alerts

        projects = []
        for project, found_sdks in outdated_sdks_per_project.items():
            unsupported = []
            for sdk_name, sdk_versions in found_sdks.items():
                unsupported.append(
                    {
                        "sdk_name": sdk_name,
                        "sdk_versions": [
                            # Required will be None in case we didn't manage to find the SDK in the compatibility
                            # list.
                            {"found": found, "required": required}
                            for found, required in sdk_versions
                        ],
                    }
                )

            projects.append({"project": project, "unsupported": unsupported})

        results["sdks"] = {"url": cls.get_found_sdks_url(organization.slug), "projects": projects}

        return results

    @classmethod
    def extract_sdks_from_data(cls, data):
        found_sdks_per_project: Mapping[str, Mapping[str, Set[str]]] = defaultdict(
            lambda: defaultdict(set)
        )

        for element in data:
            project = element.get("project")
            sdk_name = element.get("sdk.name")
            sdk_version = element.get("sdk.version")

            if sdk_name and sdk_version:
                found_sdks_per_project[project][sdk_name].add(sdk_version)

        return found_sdks_per_project

    @classmethod
    def get_outdated_sdks(cls, found_sdks_per_project):
        outdated_sdks_per_project: Mapping[
            str, Mapping[str, Set[Tuple[str, Optional[str]]]]
        ] = defaultdict(lambda: defaultdict(set))

        for project, found_sdks in found_sdks_per_project.items():
            for sdk_name, sdk_versions in found_sdks.items():
                sdk_versions_set: Set[Tuple[str, Optional[str]]] = set()
                found_supported_version = False
                min_sdk_version = SUPPORTED_SDK_VERSIONS.get(sdk_name)

                for sdk_version in sdk_versions:
                    if min_sdk_version is None:
                        # If we didn't find the SDK, we suppose it doesn't support dynamic sampling.
                        sdk_versions_set.add((sdk_version, None))
                    else:
                        # We run the semver comparison for the two sdk versions.
                        comparison = cls.compare_versions(sdk_version, min_sdk_version)
                        if comparison == -1:
                            # If the sdk version is less it means that it doesn't support dynamic sampling, and we want
                            # to add it to the unsupported list.
                            sdk_versions_set.add((sdk_version, min_sdk_version))
                        else:
                            # In case we end up here, it means that the sdk version found is >= than the minimum
                            # version, thus want to skip the iteration since we don't want to show possible unsupported
                            # versions in case at least one supported version is found.
                            found_supported_version = True
                            break

                # In case we didn't find any supported sdks, we want to return the entire list of unsupported sdks.
                if not found_supported_version and sdk_versions_set:
                    outdated_sdks_per_project[project][sdk_name].update(sdk_versions_set)

        return outdated_sdks_per_project

    @classmethod
    def get_sdks_version_used(cls, organization_id, project_objects):
        # We use the count() operation in order to group by project, sdk.name and sdk.version.
        selected_columns = ["count()", "project", "sdk.name", "sdk.version"]
        params = {
            "organization_id": organization_id,
            "project_objects": project_objects,
            "start": datetime.now(tz=pytz.UTC) - timedelta(days=QUERY_TIME_RANGE_IN_DAYS),
            "end": datetime.now(tz=pytz.UTC),
        }

        try:
            results = discover_query(
                selected_columns=selected_columns,
                query="",
                params=params,
                referrer="api.organization-events",
            )

            found_sdks_per_project = cls.extract_sdks_from_data(results.get("data"))
            outdated_sdks_per_project = cls.get_outdated_sdks(found_sdks_per_project)
            return outdated_sdks_per_project
        except Exception:
            return None

    @classmethod
    def is_metrics_data(cls, organization_id, project_objects, query):
        # We use the count operation since it's the most generic.
        selected_columns = ["count()"]
        params = {
            "organization_id": organization_id,
            "project_objects": project_objects,
            "start": datetime.now(tz=pytz.UTC) - timedelta(days=QUERY_TIME_RANGE_IN_DAYS),
            "end": datetime.now(tz=pytz.UTC),
        }

        try:
            results = performance_query(
                selected_columns=selected_columns,
                query=query,
                params=params,
                referrer="api.organization-events",
            )

            return results.get("meta", {}).get("isMetricsData", None)
        except Exception:
            return None

    @classmethod
    def get_excluded_conditions(cls):
        # We want an empty condition as identity for the AND chaining.
        qs = Q()

        for condition in EXCLUDED_CONDITIONS:
            # We want to build an AND condition with multiple negated elements.
            qs &= ~Q(conditions__icontains=condition)
            qs &= ~Q(fields__icontains=condition)

        return qs

    @classmethod
    def get_all_widgets_of_organization(cls, organization_id):
        return DashboardWidgetQuery.objects.filter(
            cls.get_excluded_conditions(),
            widget__dashboard__organization_id=organization_id,
            widget__widget_type=0,
        ).values_list(
            "widget__id",
            "widget__dashboard__id",
            "widget__dashboard__title",
            "fields",
            "conditions",
        )

    @classmethod
    def get_all_alerts_of_organization(cls, organization_id):
        return (
            AlertRule.objects.filter(
                organization_id=organization_id,
                snuba_query__dataset__in=["transactions", "discover"],
            )
            .select_related("snuba_query")
            .values_list("id", "snuba_query__aggregate", "snuba_query__query")
        )

    @classmethod
    def get_organization_metrics_compatibility(cls, organization, project_objects):
        params = {
            "organization_id": organization.id,
            "project_objects": project_objects,
            "start": datetime.now(tz=pytz.UTC) - timedelta(days=QUERY_TIME_RANGE_IN_DAYS),
            "end": datetime.now(tz=pytz.UTC),
        }

        projects = {project.id: project for project in project_objects}

        count_has_txn = "count_has_transaction_name()"
        count_null = "count_null_transactions()"
        compatible_results = metrics_performance.query(
            selected_columns=[
                "project.id",
                count_null,
                count_has_txn,
            ],
            params=params,
            query=f"{count_null}:0 AND {count_has_txn}:>0",
            referrer="api.organization-events",
            functions_acl=["count_null_transactions", "count_has_transaction_name"],
            use_aggregate_conditions=True,
        )

        compatible_project_ids = {row["project.id"] for row in compatible_results["data"]}
        incompatible_project_ids = set(projects.keys()) - compatible_project_ids

        return {
            "compatible_projects": [
                {"id": project_id, "slug": projects[project_id].slug}
                for project_id in compatible_project_ids
            ],
            "incompatible_projects": [
                {"id": project_id, "slug": projects[project_id].slug}
                for project_id in incompatible_project_ids
            ],
        }

    @classmethod
    def run_compatibility_check(cls, org_id):
        organization = Organization.objects.get(id=org_id)

        all_projects = list(Project.objects.using_replica().filter(organization=organization))

        projects_compatibility = cls.get_organization_metrics_compatibility(
            organization, all_projects
        )

        unsupported_widgets = defaultdict(list)
        for (
            widget_id,
            dashboard_id,
            dashboard_title,
            fields,
            conditions,
        ) in cls.get_all_widgets_of_organization(organization.id):
            # We run this query by selecting all projects, so that the widget query should never fail in case the
            # `query` contains "project:something".
            supports_metrics = cls.is_metrics_data(organization.id, all_projects, conditions)
            if supports_metrics is None:
                with sentry_sdk.push_scope() as scope:
                    scope.set_tag("org_id", organization.id)
                    scope.set_extra("widget_id", widget_id)
                    scope.set_extra("fields", fields)
                    scope.set_extra("conditions", conditions)

                    sentry_sdk.capture_message("Can't figure out AM2 compatibility for widget.")

                continue

            if not supports_metrics:
                # # We mark whether a metric is not supported.
                unsupported_widgets[dashboard_id].append((widget_id, fields, conditions))

        unsupported_alerts = []
        for alert_id, aggregate, query in cls.get_all_alerts_of_organization(organization.id):
            supports_metrics = cls.is_metrics_data(organization.id, all_projects, query)
            if supports_metrics is None:
                with sentry_sdk.push_scope() as scope:
                    scope.set_tag("org_id", organization.id)
                    scope.set_extra("alert_id", alert_id)
                    scope.set_extra("aggregate", aggregate)
                    scope.set_extra("query", query)

                    sentry_sdk.capture_message("Can't figure out AM2 compatibility for alert.")

                continue

            if not supports_metrics:
                # We mark whether a metric is not supported.
                unsupported_alerts.append((alert_id, aggregate, query))

        outdated_sdks_per_project = cls.get_sdks_version_used(organization.id, all_projects)
        if outdated_sdks_per_project is None:
            with sentry_sdk.push_scope() as scope:
                scope.set_tag("org_id", organization.id)

                sentry_sdk.capture_message("Can't figure out outdated SDKs.")

            outdated_sdks_per_project = {}

        return cls.format_results(
            organization,
            projects_compatibility,
            unsupported_widgets,
            unsupported_alerts,
            outdated_sdks_per_project,
        )


def generate_cache_key_for_async_progress(org_id):
    return f"ds::o:{org_id}:check_am2_compatibility_status"


def generate_cache_key_for_async_result(org_id):
    return f"ds::o:{org_id}:check_am2_compatibility_results"


def set_check_status(org_id, status, ttl=TASK_SOFT_LIMIT_IN_SECONDS):
    redis_client = get_redis_client_for_ds()
    cache_key = generate_cache_key_for_async_progress(org_id)

    redis_client.set(cache_key, status.value)
    redis_client.expire(cache_key, ttl)


def get_check_status(org_id):
    redis_client = get_redis_client_for_ds()
    cache_key = generate_cache_key_for_async_progress(org_id)

    cached_status = redis_client.get(cache_key)
    try:
        float_cached_status = float(cached_status)
        return CheckStatus(float_cached_status)
    except (TypeError, ValueError):
        return None


def set_check_results(org_id, results):
    redis_client = get_redis_client_for_ds()
    cache_key = generate_cache_key_for_async_result(org_id)

    redis_client.set(cache_key, json.dumps(results))
    redis_client.expire(cache_key, TASK_SOFT_LIMIT_IN_SECONDS)


def get_check_results(org_id):
    redis_client = get_redis_client_for_ds()
    cache_key = generate_cache_key_for_async_result(org_id)

    try:
        serialised_val = redis_client.get(cache_key)
        # We check if there is a value in cache.
        if serialised_val:
            return json.loads(serialised_val)
    except (TypeError, ValueError):
        return None


@instrumented_task(
    name="sentry.tasks.check_am2_compatibility",
    queue="dynamicsampling",
    default_retry_delay=5,
    max_retries=1,  # We don't want the system to retry such computations.
    soft_time_limit=TASK_SOFT_LIMIT_IN_SECONDS,  # 30 minutes
    time_limit=TASK_SOFT_LIMIT_IN_SECONDS + 5,  # 30 minutes + 5 seconds
)
def run_compatibility_check_async(org_id):
    try:
        set_check_status(org_id, CheckStatus.IN_PROGRESS)
        results = CheckAM2Compatibility.run_compatibility_check(org_id)
        # The expiration of these two cache keys will be arbitrarily different due to the different times in which
        # Redis might apply the operation, but we don't care, as long as the status outlives the result, since we check
        # the status for determining if we want to proceed to even read a possible result.
        set_check_status(org_id, CheckStatus.DONE)
        set_check_results(org_id, {"results": results})
    except Exception as e:
        sentry_sdk.capture_exception(e)
        # We want to store the error status for 1 minutes, after that the system will auto reset and we will run the
        # compatibility check again if follow-up requests happen.
        set_check_status(org_id, CheckStatus.ERROR, ONE_MINUTE_TTL)
