from __future__ import annotations

from collections import defaultdict
from collections.abc import Mapping, Sequence
from datetime import datetime
from typing import Annotated, Any, NotRequired, TypedDict, cast
from urllib.parse import urlencode

import sentry_sdk
from django.contrib.auth.models import AnonymousUser
from django.db.models import prefetch_related_objects

from sentry import features
from sentry.api.serializers import Serializer, register, serialize
from sentry.apidocs.descriptions import ApiDescription
from sentry.discover.arithmetic import get_equation_alias_index, is_equation, is_equation_alias
from sentry.models.dashboard import (
    Dashboard,
    DashboardFavoriteUser,
    DashboardLastVisited,
    DashboardRevision,
    QueryPriorities,
)
from sentry.models.dashboard_permissions import DashboardPermissions
from sentry.models.dashboard_widget import (
    DashboardWidget,
    DashboardWidgetDisplayTypes,
    DashboardWidgetLegendType,
    DashboardWidgetQuery,
    DashboardWidgetQueryOnDemand,
    DashboardWidgetTypes,
    DatasetSourcesTypes,
)
from sentry.organizations.absolute_url import has_customer_domain, organization_absolute_url
from sentry.search.events.fields import is_function, parse_arguments
from sentry.snuba.metrics.extraction import OnDemandMetricSpecVersioning
from sentry.users.api.serializers.user import UserSerializerResponse
from sentry.users.models.user import User
from sentry.users.services.user.model import RpcUser
from sentry.users.services.user.service import user_service
from sentry.utils import json
from sentry.utils.avatar import get_gravatar_url
from sentry.utils.dates import outside_retention_with_modified_start, parse_timestamp

DATASET_SOURCES = dict(DatasetSourcesTypes.as_choices())


class OnDemandResponse(TypedDict):
    enabled: Annotated[
        bool, ApiDescription("Whether on-demand metric extraction is enabled for the query")
    ]
    extractionState: Annotated[
        str,
        ApiDescription(
            "On-demand extraction state, such as enabled:enrolled or disabled:high-cardinality"
        ),
    ]
    dashboardWidgetQueryId: Annotated[int, ApiDescription("ID of the widget query")]


class LinkedDashboardResponse(TypedDict):
    field: Annotated[str, ApiDescription("Field that links to the dashboard")]
    dashboardId: Annotated[int, ApiDescription("ID of the linked dashboard")]


class DashboardWidgetQueryResponse(TypedDict):
    id: Annotated[str, ApiDescription("ID of the widget query")]
    name: Annotated[str, ApiDescription("Name of the query, used as the series name")]
    fields: Annotated[list[str], ApiDescription("Fields the query selects")]
    aggregates: Annotated[list[str], ApiDescription("Aggregate functions the query computes")]
    transformations: Annotated[
        dict[str, list[str]],
        ApiDescription("Transformations applied to aggregates, keyed by the aggregate's index"),
    ]
    columns: Annotated[list[str], ApiDescription("Columns the query groups by")]
    fieldAliases: Annotated[
        list[str], ApiDescription("Aliases shown in place of field names in table headers")
    ]
    conditions: Annotated[str, ApiDescription("Search query that filters the data")]
    orderby: Annotated[str, ApiDescription("Field the results are sorted by")]
    widgetId: Annotated[str, ApiDescription("ID of the widget the query belongs to")]
    onDemand: Annotated[
        list[OnDemandResponse], ApiDescription("On-demand metric extraction settings for the query")
    ]
    isHidden: Annotated[bool, ApiDescription("Whether the query is hidden from the UI")]
    selectedAggregate: Annotated[
        int | None, ApiDescription("Index of the aggregate shown by Big Number widgets")
    ]
    linkedDashboards: Annotated[
        list[LinkedDashboardResponse],
        ApiDescription("Dashboards linked from fields in the query's results"),
    ]


class ThresholdTypeOptional(TypedDict, total=False):
    preferredPolarity: Annotated[
        str, ApiDescription("Whether higher (+) or lower (-) values are better. Empty when unset")
    ]
    timeWindow: Annotated[
        str,
        ApiDescription(
            "Time window the thresholds apply to, as a stats period such as 5m, 1h or 1d"
        ),
    ]


class ThresholdType(ThresholdTypeOptional):
    max_values: Annotated[dict[str, int], ApiDescription("Threshold maximums, keyed max1 and max2")]
    unit: Annotated[str, ApiDescription("Unit of the threshold values")]


def _convert_thresholds_to_camel_case(
    thresholds: dict[str, object] | None,
) -> ThresholdType | None:
    if thresholds is None:
        return None

    result: ThresholdType = {
        # We currently do not convert max_values to camelCase because the frontend already expects it in snake_case.
        "max_values": cast("dict[str, int]", thresholds.get("max_values", {})),
        "unit": cast(str, thresholds.get("unit", "")),
    }
    if thresholds.get("preferred_polarity") is not None:
        result["preferredPolarity"] = cast(str, thresholds["preferred_polarity"])
    if thresholds.get("time_window") is not None:
        result["timeWindow"] = cast(str, thresholds["time_window"])
    return result


class WidgetChangedReasonType(TypedDict):
    orderby: Annotated[
        list[dict[str, str]] | None,
        ApiDescription(
            "Sort orders that were dropped when the widget was migrated from transactions to spans"
        ),
    ]
    equations: Annotated[
        list[dict[str, str | list[str]]] | None,
        ApiDescription(
            "Equations that were dropped when the widget was migrated from transactions to spans"
        ),
    ]
    selected_columns: Annotated[
        list[str],
        ApiDescription(
            "Columns that were dropped when the widget was migrated from transactions to spans"
        ),
    ]


class DashboardWidgetResponse(TypedDict):
    id: Annotated[str, ApiDescription("ID of the widget")]
    title: Annotated[str, ApiDescription("Title of the widget")]
    description: Annotated[str | None, ApiDescription("Description of the widget")]
    displayType: Annotated[
        str | None,
        ApiDescription("How the widget is displayed, such as line, area, bar, table or big_number"),
    ]
    thresholds: Annotated[
        ThresholdType | None, ApiDescription("Thresholds that color the widget's values")
    ]
    interval: Annotated[str, ApiDescription("Time interval for the widget's series, such as 5m")]
    dateCreated: Annotated[datetime, ApiDescription("When the widget was created (ISO 8601)")]
    dashboardId: Annotated[str, ApiDescription("ID of the dashboard the widget belongs to")]
    queries: Annotated[
        list[DashboardWidgetQueryResponse], ApiDescription("Queries that provide the widget's data")
    ]
    limit: Annotated[
        int | None, ApiDescription("Maximum number of series or rows the widget shows")
    ]
    widgetType: Annotated[
        str | None,
        ApiDescription("Dataset the widget queries, such as error-events, spans, logs or issue"),
    ]
    layout: Annotated[
        dict[str, int] | None,
        ApiDescription("Position and size of the widget on the dashboard grid"),
    ]
    axisRange: Annotated[str | None, ApiDescription("Y-axis range: auto or dataMin")]
    legendType: Annotated[
        DashboardWidgetLegendType | None, ApiDescription("Legend style: default or breakdown")
    ]
    datasetSource: Annotated[
        str | None,
        ApiDescription("Whether the widget's dataset was chosen by the user or inferred"),
    ]
    exploreUrls: NotRequired[
        Annotated[
            list[str] | None,
            ApiDescription("Explore URLs for each query, for widgets that query transactions"),
        ]
    ]
    changedReason: Annotated[
        list[WidgetChangedReasonType] | None,
        ApiDescription(
            "Parts of each query that were dropped when the widget was migrated from transactions to spans"
        ),
    ]


class DashboardPermissionsResponse(TypedDict):
    isEditableByEveryone: Annotated[
        bool, ApiDescription("Whether everyone in the organization can edit the dashboard")
    ]
    teamsWithEditAccess: Annotated[
        list[int], ApiDescription("IDs of the teams that can edit the dashboard")
    ]


@register(DashboardWidget)
class DashboardWidgetSerializer(Serializer[DashboardWidgetResponse]):
    def get_attrs(
        self,
        item_list: Sequence[DashboardWidget],
        user: User | RpcUser | AnonymousUser,
        **kwargs: object,
    ) -> dict[DashboardWidget, dict[str, object]]:
        result: dict[DashboardWidget, dict[str, Any]] = {}
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

    def get_explore_urls(self, obj: DashboardWidget, attrs: Mapping[Any, Any]) -> list[str]:
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
                else (spans_query.aggregates or [])
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
                else (spans_query.columns or [])
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
                "query": f"{spans_query.conditions}{f' AND release:{",".join(release)}' if release else ''}",
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

    def serialize(
        self,
        obj: DashboardWidget,
        attrs: Mapping[Any, Any],
        user: User | RpcUser | AnonymousUser,
        **kwargs: object,
    ) -> DashboardWidgetResponse:
        # Text widgets don't have a widget_type
        if obj.display_type == DashboardWidgetDisplayTypes.TEXT:
            widget_type = None
        else:
            widget_type = (
                DashboardWidgetTypes.get_type_name(obj.widget_type)
                if obj.widget_type is not None
                else None
            )
            if widget_type is None:
                sentry_sdk.set_context(
                    "dashboard",
                    {
                        "dashboard_id": obj.dashboard_id,
                        "widget_id": obj.id,
                        "widget_type": obj.widget_type,
                        "discover_widget_split": obj.discover_widget_split,
                    },
                )
                sentry_sdk.capture_message("Widget has an unresolvable widget_type", level="error")
                # Preserves the existing behaviour rather than the desired state. There is
                # no correct dataset to report for these widgets, and `discover` is
                # deprecated -- but clients already receive it, so keep it until the
                # underlying rows are gone.
                widget_type = DashboardWidgetTypes.get_type_name(DashboardWidgetTypes.DISCOVER)

        discover_widget_type = (
            obj.widget_type == DashboardWidgetTypes.DISCOVER or obj.widget_type is None
        )

        if discover_widget_type and obj.discover_widget_split is not None:
            widget_type = DashboardWidgetTypes.get_type_name(obj.discover_widget_split)

        explore_urls = None
        if obj.widget_type == DashboardWidgetTypes.TRANSACTION_LIKE or (
            discover_widget_type
            and obj.discover_widget_split == DashboardWidgetTypes.TRANSACTION_LIKE
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
            # Default to discover type if null and not a text widget
            "widgetType": widget_type,
            "layout": obj.detail.get("layout") if obj.detail else None,
            "axisRange": obj.detail.get("axis_range") if obj.detail else None,
            "legendType": obj.detail.get("legend_type") if obj.detail else None,
            "datasetSource": DATASET_SOURCES[obj.dataset_source],
            "changedReason": obj.changed_reason,
        }

        if explore_urls:
            serialized_widget["exploreUrls"] = explore_urls

        return serialized_widget


@register(DashboardWidgetQueryOnDemand)
class DashboardWidgetQueryOnDemandSerializer(Serializer[OnDemandResponse]):
    def serialize(
        self,
        obj: DashboardWidgetQueryOnDemand,
        attrs: Mapping[Any, Any],
        user: User | RpcUser | AnonymousUser,
        **kwargs: object,
    ) -> OnDemandResponse:
        return {
            "enabled": obj.extraction_enabled(),
            "extractionState": obj.extraction_state,
            "dashboardWidgetQueryId": obj.dashboard_widget_query_id,
        }


@register(DashboardWidgetQuery)
class DashboardWidgetQuerySerializer(Serializer[DashboardWidgetQueryResponse]):
    def get_attrs(
        self,
        item_list: Sequence[DashboardWidgetQuery],
        user: User | RpcUser | AnonymousUser,
        **kwargs: object,
    ) -> dict[DashboardWidgetQuery, dict[str, list[object]]]:
        result = {}

        stateful_extraction_version = (
            OnDemandMetricSpecVersioning.get_default_spec_version().version
        )
        data_sources = cast(
            "list[OnDemandResponse]",
            serialize(
                list(
                    DashboardWidgetQueryOnDemand.objects.filter(
                        dashboard_widget_query_id__in=[i.id for i in item_list],
                        spec_version=stateful_extraction_version,
                    )
                )
            ),
        )

        for widget_query in item_list:
            widget_data_sources: list[object] = [
                d for d in data_sources if d["dashboardWidgetQueryId"] == widget_query.id
            ]

            # Convert field links to response format
            linked_dashboards: list[object] = [
                {"field": link.field, "dashboardId": link.dashboard_id}
                for link in widget_query.dashboardfieldlink_set.all()
            ]

            result[widget_query] = {
                "onDemand": widget_data_sources,
                "linkedDashboards": linked_dashboards,
            }

        return result

    def serialize(
        self,
        obj: DashboardWidgetQuery,
        attrs: Mapping[Any, Any],
        user: User | RpcUser | AnonymousUser,
        **kwargs: object,
    ) -> DashboardWidgetQueryResponse:
        return {
            "id": str(obj.id),
            "name": obj.name,
            "fields": obj.fields,
            "aggregates": obj.aggregates or [],
            "transformations": obj.transformations or {},
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
class DashboardPermissionsSerializer(Serializer[DashboardPermissionsResponse]):
    def serialize(
        self,
        obj: DashboardPermissions,
        attrs: Mapping[Any, Any],
        user: User | RpcUser | AnonymousUser,
        **kwargs: object,
    ) -> DashboardPermissionsResponse:
        return {
            "isEditableByEveryone": obj.is_editable_by_everyone,
            "teamsWithEditAccess": cast(
                list[int], list(obj.teams_with_edit_access.values_list("id", flat=True))
            ),
        }


class DashboardListResponse(TypedDict):
    id: Annotated[str, ApiDescription("ID of the dashboard")]
    title: Annotated[str, ApiDescription("Title of the dashboard")]
    dateCreated: Annotated[datetime, ApiDescription("When the dashboard was created (ISO 8601)")]
    createdBy: Annotated[
        UserSerializerResponse | None, ApiDescription("User who created the dashboard")
    ]
    environment: Annotated[list[str], ApiDescription("Saved environment filter for the dashboard")]
    filters: Annotated[
        DashboardFilters, ApiDescription("Saved release and global filters for the dashboard")
    ]
    lastVisited: Annotated[
        datetime | None, ApiDescription("When the dashboard was last visited (ISO 8601)")
    ]
    widgetDisplay: Annotated[
        list[str | None], ApiDescription("Display type of each widget, in order")
    ]
    widgetPreview: Annotated[
        list[dict[str, str | None]],
        ApiDescription("Display type and layout of each widget, for rendering a preview"),
    ]
    permissions: Annotated[
        DashboardPermissionsResponse | None, ApiDescription("Edit permissions for the dashboard")
    ]
    isFavorited: Annotated[
        bool, ApiDescription("Whether the requesting user favorited the dashboard")
    ]
    projects: Annotated[
        list[int], ApiDescription("Saved project filter for the dashboard. [-1] means all projects")
    ]
    prebuiltId: Annotated[
        int | None, ApiDescription("ID of the prebuilt dashboard this dashboard comes from")
    ]


class _WidgetPreview(TypedDict):
    displayType: str | None
    layout: dict[str, str] | None


class _Widget(TypedDict):
    widget_display: list[str | None]
    widget_preview: list[_WidgetPreview]
    created_by: UserSerializerResponse | None
    permissions: NotRequired[dict[str, object]]
    is_favorited: NotRequired[bool]
    projects: list[int]
    environment: list[str]
    filters: DashboardFilters
    last_visited: datetime | None


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
    def get_attrs(
        self, item_list: Sequence[Dashboard], user: User | RpcUser | AnonymousUser, **kwargs: object
    ) -> dict[Dashboard, _Widget]:
        item_dict = {i.id: i for i in item_list}
        prefetch_related_objects(item_list, "projects__organization")

        context = cast("Mapping[str, Any]", kwargs.get("context") or {})
        organization = context.get("organization")
        use_user_last_visited = organization is not None and features.has(
            "organizations:dashboards-user-last-visited", organization, actor=user
        )
        user_last_visited_map: dict[int, datetime] = {}
        if use_user_last_visited:
            user_last_visited_map = {
                dlv.dashboard_id: dlv.last_visited
                for dlv in DashboardLastVisited.objects.filter(
                    user_id=cast("str | int", user.id),
                    dashboard_id__in=item_dict.keys(),
                )
            }

        widgets = DashboardWidget.objects.filter(dashboard_id__in=item_dict.keys()).order_by("id")

        favorited_dashboard_ids = set(
            DashboardFavoriteUser.objects.filter(
                user_id=cast("str | int", user.id),
                dashboard_id__in=item_dict.keys(),
                favorited=True,
            ).values_list("dashboard_id", flat=True)
        )

        permissions = DashboardPermissions.objects.filter(
            dashboard_id__in=item_dict.keys()
        ).prefetch_related("teams_with_edit_access")

        result: dict[Dashboard, _Widget]
        result = defaultdict(
            lambda: {
                "widget_display": [],
                "widget_preview": [],
                "created_by": None,
                "projects": [],
                "environment": [],
                "filters": {},
                "last_visited": None,
            }
        )
        for widget in widgets:
            dashboard = item_dict[widget.dashboard_id]
            result[dashboard]["widget_display"].append(
                DashboardWidgetDisplayTypes.get_type_name(widget.display_type)
            )

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
            # TODO: Only keep the last_visited per user logic once `dashboards-user-last-visited` is fully rolled out
            if use_user_last_visited:
                result[dashboard]["last_visited"] = user_last_visited_map.get(dashboard.id)
            else:
                result[dashboard]["last_visited"] = dashboard.last_visited

            result[dashboard]["created_by"] = serialized_users.get(str(dashboard.created_by_id))
            result[dashboard]["is_favorited"] = dashboard.id in favorited_dashboard_ids

            page_filters, tag_filters = self.get_filters(dashboard)
            result[dashboard]["projects"] = page_filters.get("projects", [])
            result[dashboard]["environment"] = page_filters.get("environment", [])
            result[dashboard]["filters"] = tag_filters

        return result

    def serialize(
        self,
        obj: Dashboard,
        attrs: Mapping[Any, Any],
        user: User | RpcUser | AnonymousUser,
        **kwargs: object,
    ) -> DashboardListResponse:
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


# Mirrors the GlobalFilter type in static/app/views/dashboards/types.tsx, which
# is the only writer of these filters.
class DashboardGlobalFilterTag(TypedDict):
    key: Annotated[str, ApiDescription("Key of the tag or attribute the filter applies to")]
    name: Annotated[str, ApiDescription("Display name of the tag or attribute")]
    kind: NotRequired[
        Annotated[str, ApiDescription("Kind of the field, such as tag, measurement or field")]
    ]


class DashboardGlobalFilter(TypedDict):
    dataset: Annotated[
        str,
        ApiDescription(
            "Widget dataset the filter applies to, such as error-events, transaction-like, spans or logs"
        ),
    ]
    tag: Annotated[DashboardGlobalFilterTag, ApiDescription("Tag or attribute being filtered")]
    value: Annotated[
        str, ApiDescription("Filter condition in search syntax, such as browser.name:[Chrome]")
    ]
    isTemporary: NotRequired[
        Annotated[
            bool, ApiDescription("Whether the filter comes from a link and isn't saved by the user")
        ]
    ]


class DashboardFilters(TypedDict, total=False):
    release: Annotated[list[str], ApiDescription("Saved release filter")]
    releaseId: Annotated[list[str], ApiDescription("Saved release ID filter")]
    globalFilter: Annotated[
        list[DashboardGlobalFilter], ApiDescription("Saved global filters applied to every widget")
    ]


class DashboardDetailsResponseOptional(TypedDict, total=False):
    environment: Annotated[list[str], ApiDescription("Saved environment filter for the dashboard")]
    period: Annotated[str, ApiDescription("Saved relative time range, such as 24h")]
    utc: Annotated[str, ApiDescription("Whether the saved time range is shown in UTC")]
    expired: Annotated[
        bool,
        ApiDescription(
            "Whether the saved start time was outside data retention and was moved forward"
        ),
    ]
    start: Annotated[datetime, ApiDescription("Saved start of the time range (ISO 8601)")]
    end: Annotated[datetime, ApiDescription("Saved end of the time range (ISO 8601)")]


class DashboardDetailsResponse(DashboardDetailsResponseOptional):
    id: Annotated[str, ApiDescription("ID of the dashboard")]
    title: Annotated[str, ApiDescription("Title of the dashboard")]
    dateCreated: Annotated[datetime, ApiDescription("When the dashboard was created (ISO 8601)")]
    createdBy: Annotated[
        UserSerializerResponse | None, ApiDescription("User who created the dashboard")
    ]
    widgets: Annotated[list[DashboardWidgetResponse], ApiDescription("Widgets on the dashboard")]
    projects: Annotated[
        list[int], ApiDescription("Saved project filter for the dashboard. [-1] means all projects")
    ]
    filters: Annotated[
        DashboardFilters, ApiDescription("Saved release and global filters for the dashboard")
    ]
    permissions: Annotated[
        DashboardPermissionsResponse | None, ApiDescription("Edit permissions for the dashboard")
    ]
    isFavorited: Annotated[
        bool, ApiDescription("Whether the requesting user favorited the dashboard")
    ]
    prebuiltId: Annotated[
        int | None, ApiDescription("ID of the prebuilt dashboard this dashboard comes from")
    ]
    queryPriority: Annotated[
        str, ApiDescription("Query priority for the dashboard: normal or faster")
    ]


@register(Dashboard)
class DashboardDetailsModelSerializer(Serializer, DashboardFiltersMixin):
    def get_attrs(
        self,
        item_list: Sequence[Dashboard],
        user: User | RpcUser | AnonymousUser,
        **kwargs: object,
    ) -> dict[Dashboard, dict[str, object]]:
        result: dict[Dashboard, dict[str, object]] = {}

        widgets = cast(
            "list[DashboardWidgetResponse]",
            serialize(
                list(
                    DashboardWidget.objects.filter(
                        dashboard_id__in=[i.id for i in item_list]
                    ).order_by("id")
                ),
                user=user,
            ),
        )

        creator_ids = [d.created_by_id for d in item_list if d.created_by_id is not None]
        serialized_creators = (
            user_service.serialize_many(filter={"user_ids": creator_ids}) if creator_ids else []
        )
        serialized_users = {
            u["id"]: u for u in cast("list[dict[str, object]]", serialized_creators)
        }

        for dashboard in item_list:
            dashboard_widgets = [w for w in widgets if w and w["dashboardId"] == str(dashboard.id)]
            created_by = (
                serialized_users.get(str(dashboard.created_by_id))
                if dashboard.created_by_id is not None
                else None
            )
            result[dashboard] = {"widgets": dashboard_widgets, "created_by": created_by}

        return result

    def serialize(
        self,
        obj: Dashboard,
        attrs: Mapping[Any, Any],
        user: User | RpcUser | AnonymousUser,
        **kwargs: object,
    ) -> DashboardDetailsResponse:
        page_filters, tag_filters = self.get_filters(obj)
        query_priority = QueryPriorities.get_type_name(obj.query_priority)
        if query_priority is None:
            query_priority = "normal"

        data: DashboardDetailsResponse = {
            "id": str(obj.id),
            "title": obj.title,
            "dateCreated": obj.date_added,
            "createdBy": attrs.get("created_by"),
            "widgets": attrs["widgets"],
            "filters": tag_filters,
            "permissions": serialize(obj.permissions) if hasattr(obj, "permissions") else None,
            "isFavorited": cast("int", user.id) in obj.favorited_by,
            "projects": page_filters.get("projects", []),
            "environment": page_filters.get("environment", []),
            "prebuiltId": obj.prebuilt_id,
            "queryPriority": query_priority,
            **page_filters,
        }

        return data


class DashboardRevisionCreatedByResponse(TypedDict):
    id: Annotated[str, ApiDescription("ID of the user")]
    name: Annotated[str, ApiDescription("Display name of the user")]
    email: Annotated[str, ApiDescription("Primary email address of the user")]
    avatarType: Annotated[
        str | None, ApiDescription("Avatar type, such as letter_avatar, upload or gravatar")
    ]
    avatarUrl: Annotated[
        str | None, ApiDescription("URL of the avatar image, or null if none is set")
    ]


class DashboardRevisionResponse(TypedDict):
    id: Annotated[str, ApiDescription("ID of the revision")]
    title: Annotated[str, ApiDescription("Title of the dashboard in this revision")]
    dateCreated: Annotated[datetime, ApiDescription("When the revision was recorded (ISO 8601)")]
    createdBy: Annotated[
        DashboardRevisionCreatedByResponse | None,
        ApiDescription(
            "User whose change recorded the revision, or null if there is no such user or it was deleted"
        ),
    ]
    source: Annotated[
        str,
        ApiDescription(
            "Change that recorded the revision, which holds the dashboard as it was just before that change: edit (a dashboard edit), edit-with-agent (an edit the client marked as made by an AI agent) or pre-restore (a restore of another revision)"
        ),
    ]


@register(DashboardRevision)
class DashboardRevisionSerializer(Serializer[DashboardRevisionResponse]):
    def get_attrs(
        self,
        item_list: Sequence[DashboardRevision],
        user: User | RpcUser | AnonymousUser,
        **kwargs: object,
    ) -> dict[DashboardRevision, dict[str, object]]:
        user_ids = [r.created_by_id for r in item_list if r.created_by_id is not None]
        users_by_id = {
            u["id"]: u
            for u in cast(
                "list[dict[str, object]]",
                user_service.serialize_many(filter={"user_ids": user_ids}),
            )
        }
        result: dict[DashboardRevision, dict[str, object]] = {
            revision: {"created_by": users_by_id.get(str(revision.created_by_id))}
            for revision in item_list
        }
        return result

    def serialize(
        self,
        obj: DashboardRevision,
        attrs: Mapping[Any, Any],
        user: User | RpcUser | AnonymousUser,
        **kwargs: object,
    ) -> DashboardRevisionResponse:
        created_by = attrs.get("created_by") or {}
        avatar = created_by.get("avatar") or {}
        avatar_type = avatar.get("avatarType")
        return {
            "id": str(obj.id),
            "title": obj.title,
            "dateCreated": obj.date_added,
            "createdBy": {
                "id": created_by["id"],
                "name": created_by["name"],
                "email": created_by["email"],
                "avatarType": avatar_type,
                "avatarUrl": get_gravatar_url(created_by["email"], size=32)
                if avatar_type == "gravatar"
                else avatar.get("avatarUrl"),
            }
            if created_by
            else None,
            "source": obj.source,
        }
