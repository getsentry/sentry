from __future__ import annotations

from collections import defaultdict
from datetime import datetime
from typing import Any, NotRequired, TypedDict
from urllib.parse import urlencode

from django.db.models import prefetch_related_objects

from sentry import features
from sentry.api.serializers import Serializer, register, serialize
from sentry.discover.arithmetic import get_equation_alias_index, is_equation, is_equation_alias
from sentry.models.dashboard import Dashboard, DashboardFavoriteUser
from sentry.models.dashboard_permissions import DashboardPermissions
from sentry.models.dashboard_widget import (
    DashboardWidget,
    DashboardWidgetDisplayTypes,
    DashboardWidgetQuery,
    DashboardWidgetQueryOnDemand,
    DashboardWidgetTypes,
    DatasetSourcesTypes,
)
from sentry.organizations.absolute_url import has_customer_domain, organization_absolute_url
from sentry.search.events.fields import is_function, parse_arguments
from sentry.snuba.metrics.extraction import OnDemandMetricSpecVersioning
from sentry.users.api.serializers.user import UserSerializerResponse
from sentry.users.services.user.service import user_service
from sentry.utils import json
from sentry.utils.dates import outside_retention_with_modified_start, parse_timestamp

DATASET_SOURCES = dict(DatasetSourcesTypes.as_choices())


class OnDemandResponse(TypedDict):
    enabled: bool
    extractionState: str
    dashboardWidgetQueryId: int


class LinkedDashboardResponse(TypedDict):
    field: str
    dashboardId: int


class DashboardWidgetQueryResponse(TypedDict):
    id: str
    name: str
    fields: list[str]
    aggregates: list[str]
    columns: list[str]
    fieldAliases: list[str]
    conditions: str
    orderby: str
    widgetId: str
    onDemand: list[OnDemandResponse]
    isHidden: bool
    selectedAggregate: int | None
    linkedDashboards: list[LinkedDashboardResponse]


class ThresholdTypeOptional(TypedDict, total=False):
    preferredPolarity: str


class ThresholdType(ThresholdTypeOptional):
    max_values: dict[str, int]
    unit: str


def _convert_thresholds_to_camel_case(thresholds: dict[str, Any] | None) -> ThresholdType | None:
    if thresholds is None:
        return None

    result: ThresholdType = {
        # We currently do not convert max_values to camelCase because the frontend already expects it in snake_case.
        "max_values": thresholds.get("max_values", {}),
        "unit": thresholds.get("unit", ""),
    }
    if thresholds.get("preferred_polarity"):
        result["preferredPolarity"] = thresholds["preferred_polarity"]
    return result


class WidgetChangedReasonType(TypedDict):
    orderby: list[dict[str, str]] | None
    equations: list[dict[str, str | list[str]]] | None
    selected_columns: list[str]


class DashboardWidgetResponse(TypedDict):
    id: str
    title: str
    description: str | None
    displayType: str
    thresholds: ThresholdType | None
    interval: str
    dateCreated: str
    dashboardId: str
    queries: list[DashboardWidgetQueryResponse]
    limit: int | None
    widgetType: str
    layout: dict[str, int] | None
    datasetSource: str | None
    exploreUrls: NotRequired[list[str] | None]
    changedReason: list[WidgetChangedReasonType] | None


class DashboardPermissionsResponse(TypedDict):
    isEditableByEveryone: bool
    teamsWithEditAccess: list[int]


@register(DashboardWidget)
class DashboardWidgetSerializer(Serializer):
    def get_attrs(self, item_list, user, **kwargs):
        result = {}
        data_sources = serialize(
            list(
                DashboardWidgetQuery.objects.filter(widget_id__in=[i.id for i in item_list])
                .prefetch_related("dashboardwidgetqueryondemand_set", "dashboardfieldlink_set")
                .order_by("order")
            )
        )

        for widget in item_list:
            widget_data_sources = [d for d in data_sources if d["widgetId"] == str(widget.id)]
            result[widget] = {"queries": widget_data_sources}

        return result

    def get_explore_urls(self, obj, attrs):
        from sentry.explore.translation.dashboards_translation import (
            translate_dashboard_widget_queries,
        )

        transaction_queries = attrs["queries"]
        urls = []

        for q_index, transaction_query in enumerate(transaction_queries):
            try:
                spans_query, _ = translate_dashboard_widget_queries(
                    obj,
                    q_index,
                    transaction_query["name"],
                    transaction_query["fields"],
                    transaction_query["columns"],
                    transaction_query["aggregates"],
                    transaction_query["orderby"],
                    transaction_query["conditions"],
                    transaction_query["fieldAliases"],
                    transaction_query["isHidden"],
                    transaction_query["selectedAggregate"],
                )
            except Exception:
                continue

            aggregate_equation_fields = [
                field for field in spans_query.fields if is_function(field) or is_equation(field)
            ]
            y_axes = (
                aggregate_equation_fields
                if obj.display_type == DashboardWidgetDisplayTypes.TABLE
                else spans_query.aggregates
            )

            explore_mode = "aggregate"
            chart_type = 1
            match obj.display_type:
                case DashboardWidgetDisplayTypes.BAR_CHART:
                    explore_mode = "aggregate"
                    chart_type = 0
                case DashboardWidgetDisplayTypes.LINE_CHART:
                    explore_mode = "aggregate"
                    chart_type = 1
                case DashboardWidgetDisplayTypes.AREA_CHART:
                    explore_mode = "aggregate"
                    chart_type = 2
                case DashboardWidgetDisplayTypes.TABLE:
                    if len(y_axes) > 0:
                        explore_mode = "aggregate"
                    else:
                        explore_mode = "samples"
                case DashboardWidgetDisplayTypes.BIG_NUMBER:
                    if len(y_axes) > 0:
                        explore_mode = "aggregate"
                    else:
                        explore_mode = "samples"
                case _:
                    explore_mode = "samples"

            filters = obj.dashboard.filters
            release = []
            if filters:
                release = filters.get("release", [])

            non_aggregate_group_by_fields = [
                field
                for field in spans_query.fields
                if not is_function(field) and not is_equation(field) and field != "timestamp"
            ]

            group_by = (
                non_aggregate_group_by_fields
                if spans_query.fields and obj.display_type == DashboardWidgetDisplayTypes.TABLE
                else spans_query.columns
            )
            if len(group_by) == 0:
                group_by = [""]

            y_axis_fields = []
            for function in y_axes:
                match = is_function(function)
                if match:
                    args_string = match.group("columns")
                    args = parse_arguments(match.group("columns"), args_string)
                    y_axis_fields.extend(args)

            fields = list(set(group_by + y_axis_fields))

            sort_direction = "-" if spans_query.orderby.startswith("-") else ""
            sort_column = spans_query.orderby.lstrip("-")
            sort = None

            if match := is_function(sort_column):
                if explore_mode == "samples":
                    args = parse_arguments(match.group("function"), match.group("columns"))
                    if args:
                        sort = f"{sort_direction}{args[0]}"
                elif explore_mode == "aggregate":
                    sort = spans_query.orderby
            elif is_equation_alias(sort_column) and explore_mode == "aggregate":
                equations = [field for field in spans_query.fields if is_equation(field)]
                equation_index = get_equation_alias_index(sort_column)
                if equation_index is not None:
                    try:
                        orderby = equations[equation_index]
                        sort = f"{sort_direction}{orderby}"
                    except IndexError:
                        sort = None
                else:
                    sort = None
            elif not is_function(sort_column) and not is_equation(sort_column):
                sort = spans_query.orderby

            # making the visualize as json strings because urlencode does not format this properly
            if len(y_axes) > 0:
                visualize = [
                    json.dumps(
                        {
                            "groupBy": group,
                        }
                    )
                    for group in group_by
                ] + [
                    json.dumps(
                        {
                            "yAxes": [y_axis],
                            "chartType": chart_type,
                        }
                    )
                    for y_axis in y_axes
                ]
            else:
                visualize = [
                    json.dumps(
                        {
                            "yAxes": [y_axis],
                            "chartType": chart_type,
                        }
                    )
                    for y_axis in y_axes
                ]

            all_query_params = {
                "mode": explore_mode,
                # using aggregateField instead of visualize + groupBy because that format will be deprecated
                "aggregateField": visualize,
                "field": fields,
                "query": f"{spans_query.conditions}{f" AND release:{",".join(release)}" if release else ""}",
                "sort": sort,
                "interval": obj.interval,
                "referrer": "dashboards.widget-transaction-deprecation-warning",
            }

            filtered_query_params = {
                k: v for k, v in all_query_params.items() if v is not None and v != []
            }

            url = organization_absolute_url(
                has_customer_domain=has_customer_domain(),
                slug=obj.dashboard.organization.slug,
                path="/explore/traces/",
                query=urlencode(filtered_query_params, doseq=True),
            )

            urls.append(url)

        return urls

    def serialize(self, obj, attrs, user, **kwargs) -> DashboardWidgetResponse:
        widget_type = (
            DashboardWidgetTypes.get_type_name(obj.widget_type)
            or DashboardWidgetTypes.TYPE_NAMES[0]
        )

        if (
            obj.widget_type == DashboardWidgetTypes.DISCOVER
            and obj.discover_widget_split is not None
        ):
            widget_type = DashboardWidgetTypes.get_type_name(obj.discover_widget_split)

        explore_urls = None
        if (
            obj.widget_type == DashboardWidgetTypes.TRANSACTION_LIKE
            or (
                obj.widget_type == DashboardWidgetTypes.DISCOVER
                and obj.discover_widget_split == DashboardWidgetTypes.TRANSACTION_LIKE
            )
        ) and features.has(
            "organizations:transaction-widget-deprecation-explore-view",
            organization=obj.dashboard.organization,
            actor=user,
        ):
            try:
                explore_urls = self.get_explore_urls(obj, attrs)
            except Exception:
                explore_urls = None

        serialized_widget: DashboardWidgetResponse = {
            "id": str(obj.id),
            "title": obj.title,
            "description": obj.description,
            "displayType": DashboardWidgetDisplayTypes.get_type_name(obj.display_type),
            "thresholds": _convert_thresholds_to_camel_case(obj.thresholds),
            # Default value until a backfill can be done.
            "interval": str(obj.interval or "5m"),
            "dateCreated": obj.date_added,
            "dashboardId": str(obj.dashboard_id),
            "queries": attrs["queries"],
            "limit": obj.limit,
            # Default to discover type if null
            "widgetType": widget_type,
            "layout": obj.detail.get("layout") if obj.detail else None,
            "datasetSource": DATASET_SOURCES[obj.dataset_source],
            "changedReason": obj.changed_reason,
        }

        if explore_urls:
            serialized_widget["exploreUrls"] = explore_urls

        return serialized_widget


@register(DashboardWidgetQueryOnDemand)
class DashboardWidgetQueryOnDemandSerializer(Serializer):
    def serialize(self, obj, attrs, user, **kwargs) -> OnDemandResponse:
        return {
            "enabled": obj.extraction_enabled(),
            "extractionState": obj.extraction_state,
            "dashboardWidgetQueryId": obj.dashboard_widget_query_id,
        }


@register(DashboardWidgetQuery)
class DashboardWidgetQuerySerializer(Serializer):
    def get_attrs(self, item_list, user, **kwargs):
        result = {}

        stateful_extraction_version = (
            OnDemandMetricSpecVersioning.get_default_spec_version().version
        )
        data_sources = serialize(
            list(
                DashboardWidgetQueryOnDemand.objects.filter(
                    dashboard_widget_query_id__in=[i.id for i in item_list],
                    spec_version=stateful_extraction_version,
                )
            )
        )

        for widget_query in item_list:
            widget_data_sources = [
                d for d in data_sources if d["dashboardWidgetQueryId"] == widget_query.id
            ]

            # Convert field links to response format
            linked_dashboards = [
                {"field": link.field, "dashboardId": link.dashboard_id}
                for link in widget_query.dashboardfieldlink_set.all()
            ]

            result[widget_query] = {
                "onDemand": widget_data_sources,
                "linkedDashboards": linked_dashboards,
            }

        return result

    def serialize(self, obj, attrs, user, **kwargs) -> DashboardWidgetQueryResponse:
        return {
            "id": str(obj.id),
            "name": obj.name,
            "fields": obj.fields,
            "aggregates": obj.aggregates or [],
            "columns": obj.columns or [],
            "fieldAliases": obj.field_aliases or [],
            "conditions": str(obj.conditions),
            "orderby": str(obj.orderby),
            "widgetId": str(obj.widget_id),
            "onDemand": attrs["onDemand"],
            "isHidden": obj.is_hidden,
            "selectedAggregate": obj.selected_aggregate,
            "linkedDashboards": attrs["linkedDashboards"],
        }


@register(DashboardPermissions)
class DashboardPermissionsSerializer(Serializer):
    def serialize(self, obj, attrs, user, **kwargs) -> DashboardPermissionsResponse:
        return {
            "isEditableByEveryone": obj.is_editable_by_everyone,
            "teamsWithEditAccess": list(obj.teams_with_edit_access.values_list("id", flat=True)),
        }


class DashboardListResponse(TypedDict):
    id: str
    title: str
    dateCreated: str
    createdBy: UserSerializerResponse
    environment: list[str]
    filters: DashboardFilters
    lastVisited: str | None
    widgetDisplay: list[str]
    widgetPreview: list[dict[str, str]]
    permissions: DashboardPermissionsResponse | None
    isFavorited: bool
    projects: list[int]
    prebuiltId: int | None


class _WidgetPreview(TypedDict):
    displayType: str
    layout: dict[str, str] | None


class _Widget(TypedDict):
    widget_display: list[str]
    widget_preview: list[_WidgetPreview]
    created_by: dict[str, Any] | None
    permissions: NotRequired[dict[str, Any]]
    is_favorited: NotRequired[bool]
    projects: list[int]
    environment: list[str]
    filters: DashboardFilters
    last_visited: str | None


class PageFiltersOptional(TypedDict, total=False):
    period: str
    utc: str
    expired: bool
    start: datetime
    end: datetime


class PageFilters(PageFiltersOptional):
    projects: list[int]
    environment: list[str]


class DashboardFiltersMixin:
    def get_filters(self, obj: Dashboard) -> tuple[PageFilters, DashboardFilters]:
        from sentry.api.serializers.rest_framework.base import camel_to_snake_case

        dashboard_filters = obj.get_filters()
        page_filters: PageFilters = {
            "projects": dashboard_filters.get("projects", []),
            "environment": dashboard_filters.get("environment", []),
            "expired": dashboard_filters.get("expired", False),
        }
        start, end, period = (
            dashboard_filters.get("start"),
            dashboard_filters.get("end"),
            dashboard_filters.get("period"),
        )
        if start and end:
            start_parsed, end_parsed = parse_timestamp(start), parse_timestamp(end)
            page_filters["expired"], page_filters["start"] = outside_retention_with_modified_start(
                start_parsed, end_parsed, obj.organization
            )
            page_filters["end"] = end_parsed
        elif period:
            page_filters["period"] = period

        if dashboard_filters.get("utc") is not None:
            page_filters["utc"] = dashboard_filters["utc"]

        tag_filters: DashboardFilters = {}
        for filter_key in ("release", "releaseId", "globalFilter"):
            if dashboard_filters.get(camel_to_snake_case(filter_key)):
                tag_filters[filter_key] = dashboard_filters[camel_to_snake_case(filter_key)]

        return page_filters, tag_filters


class DashboardListSerializer(Serializer, DashboardFiltersMixin):
    def get_attrs(self, item_list, user, **kwargs):
        organization = kwargs.get("context", {}).get("organization")
        item_dict = {i.id: i for i in item_list}
        prefetch_related_objects(
            item_list, "projects__organization", "dashboardlastvisited_set__member"
        )

        widgets = DashboardWidget.objects.filter(dashboard_id__in=item_dict.keys()).order_by("id")

        favorited_dashboard_ids = set(
            DashboardFavoriteUser.objects.filter(
                user_id=user.id, dashboard_id__in=item_dict.keys()
            ).values_list("dashboard_id", flat=True)
        )

        permissions = DashboardPermissions.objects.filter(
            dashboard_id__in=item_dict.keys()
        ).prefetch_related("teams_with_edit_access")

        result: dict[int, _Widget]
        result = defaultdict(
            lambda: {
                "widget_display": [],
                "widget_preview": [],
                "created_by": {},
                "projects": [],
                "environment": [],
                "filters": {},
                "last_visited": None,
            }
        )
        for widget in widgets:
            dashboard = item_dict[widget.dashboard_id]
            display_type = DashboardWidgetDisplayTypes.get_type_name(widget.display_type)
            result[dashboard]["widget_display"].append(display_type)

        for widget in widgets:
            dashboard = item_dict[widget.dashboard_id]
            widget_preview: _WidgetPreview = {
                "displayType": DashboardWidgetDisplayTypes.get_type_name(widget.display_type),
                "layout": None,
            }
            if widget.detail:
                if widget.detail.get("layout"):
                    widget_preview["layout"] = widget.detail["layout"]

            result[dashboard]["widget_preview"].append(widget_preview)

        serialized_users = {
            user["id"]: user
            for user in user_service.serialize_many(
                filter={
                    "user_ids": [
                        dashboard.created_by_id
                        for dashboard in item_list
                        if dashboard.created_by_id
                    ]
                },
                as_user=user,
            )
        }

        for permission in permissions:
            dashboard = item_dict[permission.dashboard_id]
            result[dashboard]["permissions"] = serialize(permission)

        for dashboard in item_dict.values():
            if features.has(
                "organizations:dashboards-starred-reordering",
                organization,
                actor=user,
            ):
                visit = dashboard.dashboardlastvisited_set.filter(
                    dashboard=dashboard,
                    member__user_id=user.id,
                    member__organization=organization,
                ).first()
                result[dashboard]["last_visited"] = visit.last_visited if visit else None

            result[dashboard]["created_by"] = serialized_users.get(str(dashboard.created_by_id))
            result[dashboard]["is_favorited"] = dashboard.id in favorited_dashboard_ids

            page_filters, tag_filters = self.get_filters(dashboard)
            result[dashboard]["projects"] = page_filters.get("projects", [])
            result[dashboard]["environment"] = page_filters.get("environment", [])
            result[dashboard]["filters"] = tag_filters

        return result

    def serialize(self, obj, attrs, user, **kwargs) -> DashboardListResponse:
        return {
            "id": str(obj.id),
            "title": obj.title,
            "dateCreated": obj.date_added,
            "createdBy": attrs.get("created_by"),
            "widgetDisplay": attrs.get("widget_display", []),
            "widgetPreview": attrs.get("widget_preview", []),
            "permissions": attrs.get("permissions", None),
            "isFavorited": attrs.get("is_favorited", False),
            "projects": attrs.get("projects", []),
            "environment": attrs.get("environment", []),
            "filters": attrs.get("filters", {}),
            "lastVisited": attrs.get("last_visited", None),
            "prebuiltId": obj.prebuilt_id,
        }


class DashboardFilters(TypedDict, total=False):
    release: list[str]
    releaseId: list[str]
    globalFilter: list[dict[str, Any]]


class DashboardDetailsResponseOptional(TypedDict, total=False):
    environment: list[str]
    period: str
    utc: str
    expired: bool
    start: datetime
    end: datetime


class DashboardDetailsResponse(DashboardDetailsResponseOptional):
    id: str
    title: str
    dateCreated: str
    createdBy: UserSerializerResponse | None
    widgets: list[DashboardWidgetResponse]
    projects: list[int]
    filters: DashboardFilters
    permissions: DashboardPermissionsResponse | None
    isFavorited: bool
    prebuiltId: int | None


@register(Dashboard)
class DashboardDetailsModelSerializer(Serializer, DashboardFiltersMixin):
    def get_attrs(self, item_list, user, **kwargs):
        result = {}

        widgets = serialize(
            list(
                DashboardWidget.objects.filter(dashboard_id__in=[i.id for i in item_list]).order_by(
                    "id"
                )
            ),
            user=user,
        )

        for dashboard in item_list:
            dashboard_widgets = [w for w in widgets if w and w["dashboardId"] == str(dashboard.id)]
            result[dashboard] = {"widgets": dashboard_widgets}

        return result

    def serialize(self, obj, attrs, user, **kwargs) -> DashboardDetailsResponse:
        page_filters, tag_filters = self.get_filters(obj)

        if "globalFilter" in tag_filters and not features.has(
            "organizations:dashboards-global-filters",
            organization=obj.organization,
            actor=user,
        ):
            tag_filters["globalFilter"] = []

        data: DashboardDetailsResponse = {
            "id": str(obj.id),
            "title": obj.title,
            "dateCreated": obj.date_added,
            "createdBy": (
                user_service.serialize_many(filter={"user_ids": [obj.created_by_id]})[0]
                if obj.created_by_id
                else None
            ),
            "widgets": attrs["widgets"],
            "filters": tag_filters,
            "permissions": serialize(obj.permissions) if hasattr(obj, "permissions") else None,
            "isFavorited": user.id in obj.favorited_by,
            "projects": page_filters.get("projects", []),
            "environment": page_filters.get("environment", []),
            "prebuiltId": obj.prebuilt_id,
            **page_filters,
        }

        return data
