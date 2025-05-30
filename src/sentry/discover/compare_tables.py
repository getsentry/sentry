import logging
from enum import Enum
from typing import TypedDict, cast

import sentry_sdk

from sentry.discover.arithmetic import is_equation
from sentry.discover.dataset_split import _get_equation_list, _get_field_list
from sentry.discover.translation.mep_to_eap import (
    QueryParts,
    translate_columns,
    translate_mep_to_eap,
)
from sentry.models.dashboard import Dashboard
from sentry.models.dashboard_widget import DashboardWidget, DashboardWidgetQuery
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.search.eap.types import EAPResponse, SearchResolverConfig
from sentry.search.events.types import SAMPLING_MODES, EventsResponse, SnubaParams
from sentry.snuba import metrics_enhanced_performance, spans_rpc

logger = logging.getLogger(__name__)


class CompareTableResult(Enum):
    BOTH_FAILED = "both_requests_failed"
    FIELD_NOT_FOUND = "field_not_found"
    METRICS_FAILED = "metrics_failed"
    NO_FIELDS = "no_fields"
    NO_PROJECT = "no_project"
    PASSED = "passed"
    SNQL_EAP_FAILED = "snql_eap_failed"


class CompareTableResultDict(TypedDict):
    passed: bool
    reason: CompareTableResult
    fields: list[str] | None
    widget_query: DashboardWidgetQuery
    mismatches: list[str] | None


def compare_table_results(metrics_query_result: EventsResponse, eap_result: EAPResponse):
    eap_data_row = eap_result["data"][0] if len(eap_result["data"]) > 0 else {}
    metrics_data_row = (
        metrics_query_result["data"][0] if len(metrics_query_result["data"]) > 0 else {}
    )
    mismatches = []
    for field, data in metrics_data_row.items():
        if is_equation(field):
            continue
        translated_field, *rest = translate_columns([field])
        if data is not None and eap_data_row[translated_field] is None:
            logger.info("Field %s not found in EAP response", field)
            with sentry_sdk.isolation_scope() as scope:
                scope.set_tag("mismatched_field", field)
                sentry_sdk.capture_message(
                    "dashboard_comparison_mismatch_field", level="info", scope=scope
                )
            mismatches.append(field)

    return (len(mismatches) == 0, mismatches)


def compare_tables_for_dashboard_widget_queries(
    widget_query: DashboardWidgetQuery,
) -> CompareTableResultDict:
    widget: DashboardWidget = widget_query.widget
    dashboard: Dashboard = widget.dashboard
    organization: Organization = dashboard.organization
    projects: list[Project] = list(dashboard.projects.all())
    if len(list(projects)) == 0:
        return {
            "passed": False,
            "reason": CompareTableResult.NO_PROJECT,
            "fields": None,
            "widget_query": widget_query,
            "mismatches": None,
        }

    fields = widget_query.fields
    if len(fields) == 0:
        return {
            "passed": False,
            "reason": CompareTableResult.NO_FIELDS,
            "fields": None,
            "widget_query": widget_query,
            "mismatches": None,
        }

    selected_columns = _get_field_list(fields)
    equations = [equation for equation in _get_equation_list(widget_query.fields or []) if equation]
    query = widget_query.conditions

    environments = dashboard.filters.get("environment", []) if dashboard.filters is not None else []

    snuba_params = SnubaParams(
        environments=environments,
        projects=list(projects),
        organization=organization,
        stats_period="7d",
    )

    has_metrics_error = False
    has_snql_eap_error = False

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
            sampling_mode=cast(SAMPLING_MODES, "NORMAL"),
        )
    except Exception as e:
        logger.info("EAP query failed: %s", e)
        has_snql_eap_error = True

    if has_metrics_error and has_snql_eap_error:
        return {
            "passed": False,
            "reason": CompareTableResult.BOTH_FAILED,
            "fields": fields,
            "widget_query": widget_query,
            "mismatches": None,
        }
    elif has_metrics_error:
        return {
            "passed": False,
            "reason": CompareTableResult.METRICS_FAILED,
            "fields": fields,
            "widget_query": widget_query,
            "mismatches": None,
        }
    elif has_snql_eap_error:
        return {
            "passed": False,
            "reason": CompareTableResult.SNQL_EAP_FAILED,
            "fields": fields,
            "widget_query": widget_query,
            "mismatches": None,
        }
    else:
        passed, mismatches = compare_table_results(metrics_query_result, eap_result)
        if passed:
            with sentry_sdk.isolation_scope() as scope:
                scope.set_tag("passed", True)
                sentry_sdk.capture_message("dashboard_comparison_passed", level="info", scope=scope)
            return {
                "passed": True,
                "reason": CompareTableResult.PASSED,
                "fields": fields,
                "widget_query": widget_query,
                "mismatches": mismatches,
            }
        else:
            with sentry_sdk.isolation_scope() as scope:
                scope.set_tag("passed", False)
                sentry_sdk.capture_message("dashboard_comparison_passed", level="info", scope=scope)
            return {
                "passed": False,
                "reason": CompareTableResult.FIELD_NOT_FOUND,
                "fields": fields,
                "widget_query": widget_query,
                "mismatches": mismatches,
            }
