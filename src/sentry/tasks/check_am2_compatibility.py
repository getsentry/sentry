from collections import defaultdict
from datetime import datetime, timedelta
from enum import Enum
from typing import Any, Dict, List, Mapping, Set

import pytz
import sentry_sdk
from django.db.models import Q

from sentry.dynamic_sampling import get_redis_client_for_ds
from sentry.models import DashboardWidgetQuery, Organization, Project
from sentry.snuba.discover import query as discover_query
from sentry.snuba.metrics_enhanced_performance import query as performance_query
from sentry.snuba.models import QuerySubscription
from sentry.tasks.base import instrumented_task
from sentry.utils import json

# List of minimum SDK versions that support Performance at Scale.
# The list is defined here:
# https://docs.sentry.io/product/performance/performance-at-scale/getting-started
SUPPORTED_SDK_VERSIONS = {
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
    "sentry-cocoa": "7.23.0",
    "sentry-objc": "7.23.0",
    "sentry-swift": "7.23.0",
    "sentry.cocoa": "7.23.0",
    "sentry.swift": "7.23.0",
    "SentrySwift": "7.23.0",
    "sentry-android": "6.5.0",
    "sentry.java.android.timber": "6.5.0",
    "sentry.java.android": "6.5.0",
    "sentry.native.android": "6.5.0",
    "sentry-react-native": "4.3.0",
    "sentry.cocoa.react-native": "4.3.0",
    "sentry.java.android.react-native": "4.3.0",
    "sentry.javascript.react-native": "4.3.0",
    "sentry.native.android.react-native": "4.3.0",
    "dart": "6.11.0",
    "dart-sentry-client": "6.11.0",
    "sentry.dart": "6.11.0",
    "sentry.dart.logging": "6.11.0",
    "sentry.cocoa.flutter": "6.11.0",
    "sentry.dart.flutter": "6.11.0",
    "sentry.java.android.flutter": "6.11.0",
    "sentry.native.android.flutter": "6.11.0",
    "sentry.dart.browser": "6.11.0",
    "sentry-php": "3.9.0",
    "sentry.php": "3.9.0",
    "sentry-laravel": "3.0.0",
    "sentry.php.laravel": "3.0.0",
    "sentry-symfony": "4.4.0",
    "sentry.php.symfony": "4.4.0",
    "Symphony.SentryClient": "4.4.0",
    "sentry-ruby": "5.5.0",
    "sentry.ruby": "5.5.0",
    "sentry.ruby.delayed_job": "5.5.0",
    "sentry.ruby.rails": "5.5.0",
    "sentry.ruby.resque": "5.5.0",
    "sentry.ruby.sidekiq": "5.5.0",
    "sentry-java": "6.5.0",
    "sentry.java": "6.5.0",
    "sentry.java.jul": "6.5.0",
    "sentry.java.log4j2": "6.5.0",
    "sentry.java.logback": "6.5.0",
    "sentry.java.spring": "6.5.0",
    "sentry.java.spring-boot": "6.5.0",
    "sentry.java.spring-boot.jakarta": "6.5.0",
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
    "sentry.go": "0.16.0",
}

TASK_SOFT_LIMIT_IN_SECONDS = 30 * 60  # 30 minutes
ONE_MINUTE_TTL = 60  # 1 minute


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
        cls, organization, unsupported_widgets, unsupported_alerts, outdated_sdks_per_project
    ):
        results: Dict[str, Any] = {}

        widgets = []
        for dashboard_id, widgets in unsupported_widgets.items():
            unsupported = []
            for widget_id, fields, conditions in widgets:
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
        for project_id, alerts in unsupported_alerts.items():
            unsupported = []
            for alert_id, aggregate, query in alerts:
                unsupported.append(
                    {
                        "id": alert_id,
                        "url": cls.get_alert_url(organization.slug, alert_id),
                        "aggregate": aggregate,
                        "query": query,
                    }
                )
            alerts.append({"project_id": project_id, "unsupported": unsupported})

        results["alerts"] = alerts

        projects = []
        for project, found_sdks in outdated_sdks_per_project.items():
            unsupported = []
            for sdk_name, sdk_versions in found_sdks.items():
                unsupported.append({"sdk_name": sdk_name, "sdk_versions": sdk_versions})

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
        outdated_sdks_per_project: Mapping[str, Mapping[str, Set[str]]] = defaultdict(
            lambda: defaultdict(set)
        )

        for project, found_sdks in found_sdks_per_project.items():
            for sdk_name, sdk_versions in found_sdks.items():
                for sdk_version in sdk_versions:
                    min_sdk_version = SUPPORTED_SDK_VERSIONS.get(sdk_name)
                    if min_sdk_version is None:
                        # If we didn't find the SDK, we suppose it doesn't support dynamic sampling.
                        outdated_sdks_per_project[project][sdk_name].add(sdk_version)
                    else:
                        # We check if it is less, thus it is not supported.
                        comparison = cls.compare_versions(sdk_version, min_sdk_version)
                        if comparison == -1:
                            outdated_sdks_per_project[project][sdk_name].add(
                                f"{sdk_version} found {min_sdk_version} required"
                            )

        return outdated_sdks_per_project

    @classmethod
    def get_sdks_version_used(cls, organization_id, project_objects):
        # We use the count() operation in order to group by project, sdk.name and sdk.version.
        selected_columns = ["count()", "project", "sdk.name", "sdk.version"]
        params = {
            "organization_id": organization_id,
            "project_objects": project_objects,
            "start": datetime.now(tz=pytz.UTC) - timedelta(days=1),
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
            "start": datetime.now(tz=pytz.UTC) - timedelta(days=1),
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
    def get_all_widgets_of_organization(cls, organization_id):
        return DashboardWidgetQuery.objects.filter(
            Q(conditions__icontains="event.type:transaction")
            | Q(conditions__icontains="!event.type:error"),
            widget__dashboard__organization_id=organization_id,
        ).values_list(
            "id", "widget__dashboard__id", "widget__dashboard__title", "fields", "conditions"
        )

    @classmethod
    def get_all_alerts_of_project(cls, project_id):
        return (
            QuerySubscription.objects.filter(
                project_id=project_id, snuba_query__dataset__in=["transactions", "discover"]
            )
            .select_related("snuba_query")
            .values_list("id", "snuba_query__aggregate", "snuba_query__query")
        )

    @classmethod
    def run_compatibility_check(cls, org_id, errors):
        organization = Organization.objects.get(id=org_id)

        all_projects = list(Project.objects.using_replica().filter(organization=organization))

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
                errors.append(
                    f"Couldn't figure out compatibility for widget {widget_id} with fields {fields} and conditions {conditions}."
                )
                continue

            if not supports_metrics:
                # # We mark whether a metric is not supported.
                unsupported_widgets[dashboard_id].append((widget_id, fields, conditions))

        unsupported_alerts = defaultdict(list)
        for project in all_projects:
            project_id = project.id
            for alert_id, aggregate, query in cls.get_all_alerts_of_project(project_id):
                supports_metrics = cls.is_metrics_data(organization.id, [project], query)
                if supports_metrics is None:
                    errors.append(
                        f"Couldn't figure out compatibility for alert {alert_id} with aggregate {aggregate} and query {query} in project {project_id}."
                    )
                    continue

                if not supports_metrics:
                    # We mark whether a metric is not supported.
                    unsupported_alerts[project_id].append((alert_id, aggregate, query))

        outdated_sdks_per_project = cls.get_sdks_version_used(organization.id, all_projects)
        if outdated_sdks_per_project is None:
            errors.append(
                f"Couldn't figure out outdated sdks for projects of org {organization.id}."
            )
            outdated_sdks_per_project = {}

        return cls.format_results(
            organization, unsupported_widgets, unsupported_alerts, outdated_sdks_per_project
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
    errors: List[str] = []

    try:
        set_check_status(org_id, CheckStatus.IN_PROGRESS)
        results = CheckAM2Compatibility.run_compatibility_check(org_id, errors)
        # The expiration of these two cache keys will be arbitrarily different due to the different times in which
        # Redis might apply the operation, but we don't care, as long as the status outlives the result, since we check
        # the status for determining if we want to proceed to even read a possible result.
        set_check_status(org_id, CheckStatus.DONE)
        set_check_results(org_id, {"results": results, "errors": errors})
    except Exception as e:
        sentry_sdk.capture_exception(e)
        # We want to store the error status for 1 minutes, after that the system will auto reset and we will run the
        # compatibility check again if follow-up requests happen.
        set_check_status(org_id, CheckStatus.ERROR, ONE_MINUTE_TTL)
