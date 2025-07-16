import logging
from enum import Enum
from typing import TypedDict

import sentry_sdk

from sentry.constants import ObjectStatus
from sentry.discover.arithmetic import is_equation
from sentry.discover.dataset_split import _get_equation_list, _get_field_list
from sentry.discover.translation.mep_to_eap import (
    QueryParts,
    translate_columns,
    translate_mep_to_eap,
)
from sentry.models.dashboard import Dashboard
from sentry.models.dashboard_widget import DashboardWidget, DashboardWidgetQuery
from sentry.models.environment import Environment
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.organizations.absolute_url import generate_organization_url
from sentry.search.eap.types import EAPResponse, SearchResolverConfig
from sentry.search.events.fields import is_function, parse_arguments
from sentry.search.events.filter import to_list
from sentry.search.events.types import EventsResponse, SnubaParams
from sentry.snuba import metrics_enhanced_performance, spans_rpc
from sentry.utils.snuba import is_measurement

logger = logging.getLogger(__name__)


class CompareTableResult(Enum):
    BOTH_FAILED = "both_requests_failed"
    EAP_FAILED = "eap_failed"
    FIELD_NOT_FOUND = "field_not_found"
    METRICS_FAILED = "metrics_failed"
    NO_DATA = "no_data"
    NO_FIELDS = "no_fields"
    NO_PROJECT = "no_project"
    PASSED = "passed"
    QUERY_FAILED = "query_failed"


class CompareTableResultDict(TypedDict):
    passed: bool
    reason: CompareTableResult
    fields: list[str] | None
    widget_query: DashboardWidgetQuery
    mismatches: list[str] | None
    query: str | None


def compare_table_results(metrics_query_result: EventsResponse, eap_result: EAPResponse):
    eap_data_row = eap_result["data"][0] if len(eap_result["data"]) > 0 else {}
    metrics_data_row = (
        metrics_query_result["data"][0] if len(metrics_query_result["data"]) > 0 else {}
    )
    metrics_fields = metrics_query_result["meta"]["fields"]

    mismatches: list[str] = []
    no_metrics_data = len(metrics_data_row) == 0
    no_eap_data = len(eap_data_row) == 0

    # if there's no metrics data we know there are mismatches,
    # we will check the EAP data for the names of the mismatched fields
    if no_metrics_data:
        return (False, [], CompareTableResult.NO_DATA)
    if no_eap_data:
        return (False, [], CompareTableResult.QUERY_FAILED)

    try:
        for field, data in metrics_data_row.items():
            if is_equation(field):
                continue
            [translated_field, *rest], dropped_columns = translate_columns([field])
            # if we're dropping the field in eap then we can skip checking for mismatches
            if len(dropped_columns) > 0:
                continue

            arg: str | None = None
            if match := is_function(field):
                function = match.group("function")
                args = parse_arguments(function, match.group("columns"))
                if args:
                    arg = args[0]

            if data is None or (
                arg and (arg == "transaction.duration" or is_measurement(arg)) and data == 0
            ):
                continue

            if eap_data_row[translated_field] is None:
                logger.info("Field %s not found in EAP response", field)
                mismatches.append(field)

    except KeyError:
        # if there is an error trying to access fields in the EAP data,
        # return all queried fields as mismatches
        all_fields_mismatch: list[str] = []
        for field, data in metrics_fields.items():
            if is_equation(field):
                continue
            all_fields_mismatch.append(field)
        return (
            len(all_fields_mismatch) == 0,
            all_fields_mismatch,
            CompareTableResult.FIELD_NOT_FOUND,
        )

    return (
        len(mismatches) == 0,
        mismatches,
        CompareTableResult.FIELD_NOT_FOUND if len(mismatches) > 0 else CompareTableResult.PASSED,
    )


@sentry_sdk.tracing.trace
def compare_tables_for_dashboard_widget_queries(
    widget_query: DashboardWidgetQuery,
) -> CompareTableResultDict:
    widget: DashboardWidget = widget_query.widget
    dashboard: Dashboard = widget.dashboard
    organization: Organization = dashboard.organization
    # if the dashboard has no projects, we will use all projects in the organization
    projects = dashboard.projects.all() or Project.objects.filter(
        organization_id=dashboard.organization.id, status=ObjectStatus.ACTIVE
    )

    widget_viewer_url = (
        generate_organization_url(organization.slug)
        + f"/dashboard/{dashboard.id}/widget/{widget.id}/"
    )

    if len(list(projects)) == 0:
        with sentry_sdk.isolation_scope() as scope:
            scope.set_tag("passed", False)
            scope.set_tag("failed_reason", CompareTableResult.NO_PROJECT.value)
            scope.set_tag(
                "widget_viewer_url",
                widget_viewer_url,
            )
            sentry_sdk.capture_message(
                "dashboard_widget_comparison_done", level="info", scope=scope
            )
        return {
            "passed": False,
            "reason": CompareTableResult.NO_PROJECT,
            "fields": None,
            "widget_query": widget_query,
            "mismatches": None,
            "query": None,
        }

    fields = widget_query.fields
    if len(fields) == 0:
        with sentry_sdk.isolation_scope() as scope:
            scope.set_tag("passed", False)
            scope.set_tag("failed_reason", CompareTableResult.NO_FIELDS.value)
            scope.set_tag("widget_fields", fields)
            scope.set_tag(
                "widget_viewer_url",
                widget_viewer_url,
            )
            sentry_sdk.capture_message(
                "dashboard_widget_comparison_done", level="info", scope=scope
            )
        return {
            "passed": False,
            "reason": CompareTableResult.NO_FIELDS,
            "fields": None,
            "widget_query": widget_query,
            "mismatches": None,
            "query": None,
        }

    selected_columns = _get_field_list(fields)
    equations = [equation for equation in _get_equation_list(widget_query.fields or []) if equation]
    query = widget_query.conditions

    environment_names: str | list[str] = (
        dashboard.filters.get("environment", []) if dashboard.filters else []
    )
    if environment_names:
        environments = list(
            Environment.objects.filter(
                name__in=to_list(environment_names), organization_id=organization.id
            )
        )
    else:
        environments = []

    snuba_params = SnubaParams(
        environments=environments,
        projects=list(projects),
        organization=organization,
        stats_period="7d",
    )

    has_metrics_error = False
    has_eap_error = False

    try:
        metrics_query_result = metrics_enhanced_performance.query(
            selected_columns,
            query,
            snuba_params,
            equations,
            orderby=None,
            offset=None,
            limit=1,
            referrer="dashboards.transactions_spans_comparison",
            transform_alias_to_input_format=True,
            fallback_to_transactions=True,
        )

    except Exception as e:
        logger.info("Metrics query failed: %s", e)
        has_metrics_error = True

    eap_query_parts = translate_mep_to_eap(
        QueryParts(
            query=query,
            selected_columns=selected_columns,
            equations=equations,
            orderby=None,
        )
    )

    try:
        eap_result = spans_rpc.run_table_query(
            params=snuba_params,
            query_string=eap_query_parts["query"],
            selected_columns=eap_query_parts["selected_columns"],
            orderby=None,
            offset=0,
            limit=1,
            referrer="dashboards.transactions_spans_comparison",
            config=SearchResolverConfig(),
            sampling_mode="NORMAL",
        )
    except Exception as e:
        logger.info("EAP query failed: %s", e)
        has_eap_error = True

    if has_metrics_error and has_eap_error:
        with sentry_sdk.isolation_scope() as scope:
            scope.set_tag("passed", False)
            scope.set_tag("failed_reason", CompareTableResult.BOTH_FAILED.value)
            scope.set_tag("widget_filter_query", query)
            scope.set_tag("widget_fields", str(fields))
            scope.set_tag(
                "widget_viewer_url",
                widget_viewer_url,
            )
            sentry_sdk.capture_message(
                "dashboard_widget_comparison_done", level="info", scope=scope
            )
        return {
            "passed": False,
            "reason": CompareTableResult.BOTH_FAILED,
            "fields": fields,
            "widget_query": widget_query,
            "mismatches": None,
            "query": query,
        }
    elif has_metrics_error:
        with sentry_sdk.isolation_scope() as scope:
            scope.set_tag("passed", False)
            scope.set_tag("failed_reason", CompareTableResult.METRICS_FAILED.value)
            scope.set_tag("widget_filter_query", query)
            scope.set_tag("widget_fields", str(fields))
            scope.set_tag(
                "widget_viewer_url",
                widget_viewer_url,
            )
            sentry_sdk.capture_message(
                "dashboard_widget_comparison_done", level="info", scope=scope
            )
        return {
            "passed": False,
            "reason": CompareTableResult.METRICS_FAILED,
            "fields": fields,
            "widget_query": widget_query,
            "mismatches": None,
            "query": query,
        }
    elif has_eap_error:
        with sentry_sdk.isolation_scope() as scope:
            scope.set_tag("passed", False)
            scope.set_tag("failed_reason", CompareTableResult.EAP_FAILED.value)
            scope.set_tag("widget_filter_query", query)
            scope.set_tag("widget_fields", str(fields))
            scope.set_tag(
                "widget_viewer_url",
                widget_viewer_url,
            )
            sentry_sdk.capture_message(
                "dashboard_widget_comparison_done", level="info", scope=scope
            )
        return {
            "passed": False,
            "reason": CompareTableResult.EAP_FAILED,
            "fields": fields,
            "widget_query": widget_query,
            "mismatches": fields,
            "query": query,
        }
    else:
        passed, mismatches, reason = compare_table_results(metrics_query_result, eap_result)
        if passed:
            return {
                "passed": True,
                "reason": CompareTableResult.PASSED,
                "fields": fields,
                "widget_query": widget_query,
                "mismatches": mismatches,
                "query": query,
            }
        else:
            with sentry_sdk.isolation_scope() as scope:
                scope.set_tag("passed", False)
                scope.set_tag("failed_reason", reason.value)
                scope.set_tag("mismatches", str(mismatches))
                scope.set_tag("widget_filter_query", query)
                scope.set_tag("widget_fields", str(fields))
                scope.set_tag(
                    "widget_viewer_url",
                    widget_viewer_url,
                )
                sentry_sdk.capture_message(
                    "dashboard_widget_comparison_done", level="info", scope=scope
                )
            return {
                "passed": False,
                "reason": reason,
                "fields": fields,
                "widget_query": widget_query,
                "mismatches": mismatches,
                "query": query,
            }
