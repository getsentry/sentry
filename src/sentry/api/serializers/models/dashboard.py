from __future__ import annotations

from collections import defaultdict
from datetime import datetime
from typing import Any, NotRequired, TypedDict

from sentry import features
from sentry.api.serializers import Serializer, register, serialize
from sentry.constants import ALL_ACCESS_PROJECTS
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
from sentry.snuba.metrics.extraction import OnDemandMetricSpecVersioning
from sentry.users.api.serializers.user import UserSerializerResponse
from sentry.users.services.user.service import user_service
from sentry.utils.dates import outside_retention_with_modified_start, parse_timestamp

DATASET_SOURCES = dict(DatasetSourcesTypes.as_choices())


class OnDemandResponse(TypedDict):
    enabled: bool
    extractionState: str
    dashboardWidgetQueryId: int


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


class ThresholdType(TypedDict):
    max_values: dict[str, int]
    unit: str


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
                .prefetch_related("dashboardwidgetqueryondemand_set")
                .order_by("order")
            )
        )

        for widget in item_list:
            widget_data_sources = [d for d in data_sources if d["widgetId"] == str(widget.id)]
            result[widget] = {"queries": widget_data_sources}

        return result

    def serialize(self, obj, attrs, user, **kwargs) -> DashboardWidgetResponse:
        widget_type = (
            DashboardWidgetTypes.get_type_name(obj.widget_type)
            or DashboardWidgetTypes.TYPE_NAMES[0]
        )

        if (
            features.has(
                "organizations:performance-discover-dataset-selector",
                obj.dashboard.organization,
                actor=user,
            )
            and obj.discover_widget_split is not None
        ):
            widget_type = DashboardWidgetTypes.get_type_name(obj.discover_widget_split)

        return {
            "id": str(obj.id),
            "title": obj.title,
            "description": obj.description,
            "displayType": DashboardWidgetDisplayTypes.get_type_name(obj.display_type),
            "thresholds": obj.thresholds,
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
        }


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
            result[widget_query] = {"onDemand": widget_data_sources}

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
    widgetDisplay: list[str]
    widgetPreview: list[dict[str, str]]
    permissions: DashboardPermissionsResponse | None
    isFavorited: bool


class _WidgetPreview(TypedDict):
    displayType: str
    layout: dict[str, str] | None


class _Widget(TypedDict):
    widget_display: list[str]
    widget_preview: list[_WidgetPreview]
    created_by: dict[str, Any] | None
    permissions: NotRequired[dict[str, Any]]
    is_favorited: NotRequired[bool]


class DashboardListSerializer(Serializer):
    def get_attrs(self, item_list, user, **kwargs):
        item_dict = {i.id: i for i in item_list}

        widgets = DashboardWidget.objects.filter(dashboard_id__in=item_dict.keys()).order_by(
            "order"
        )

        favorited_dashboard_ids = set(
            DashboardFavoriteUser.objects.filter(
                user_id=user.id, dashboard_id__in=item_dict.keys()
            ).values_list("dashboard_id", flat=True)
        )

        permissions = DashboardPermissions.objects.filter(dashboard_id__in=item_dict.keys())

        result: dict[int, _Widget]
        result = defaultdict(lambda: {"widget_display": [], "widget_preview": [], "created_by": {}})
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
            result[dashboard]["created_by"] = serialized_users.get(str(dashboard.created_by_id))
            result[dashboard]["is_favorited"] = dashboard.id in favorited_dashboard_ids

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
        }


class DashboardFilters(TypedDict, total=False):
    release: list[str]
    releaseId: list[str]


class DashboardDetailsResponseOptional(TypedDict, total=False):
    environment: list[str]
    period: str
    utc: str
    expired: bool
    start: datetime
    end: str


class DashboardDetailsResponse(DashboardDetailsResponseOptional):
    id: str
    title: str
    dateCreated: str
    createdBy: UserSerializerResponse
    widgets: list[DashboardWidgetResponse]
    projects: list[int]
    filters: DashboardFilters
    permissions: DashboardPermissionsResponse | None
    isFavorited: bool


@register(Dashboard)
class DashboardDetailsModelSerializer(Serializer):
    def get_attrs(self, item_list, user, **kwargs):
        result = {}

        widgets = serialize(
            list(
                DashboardWidget.objects.filter(dashboard_id__in=[i.id for i in item_list]).order_by(
                    "order"
                )
            ),
            user=user,
        )

        for dashboard in item_list:
            dashboard_widgets = [w for w in widgets if w["dashboardId"] == str(dashboard.id)]
            result[dashboard] = {"widgets": dashboard_widgets}

        return result

    def serialize(self, obj, attrs, user, **kwargs) -> DashboardDetailsResponse:
        from sentry.api.serializers.rest_framework.base import camel_to_snake_case

        data: DashboardDetailsResponse = {
            "id": str(obj.id),
            "title": obj.title,
            "dateCreated": obj.date_added,
            "createdBy": user_service.serialize_many(filter={"user_ids": [obj.created_by_id]})[0],
            "widgets": attrs["widgets"],
            "projects": [project.id for project in obj.projects.all()],
            "filters": {},
            "permissions": serialize(obj.permissions) if hasattr(obj, "permissions") else None,
            "isFavorited": user.id in obj.favorited_by,
        }

        if obj.filters is not None:
            if obj.filters.get("all_projects"):
                data["projects"] = list(ALL_ACCESS_PROJECTS)

            for tl_key in ("environment", "period", "utc"):
                if obj.filters.get(tl_key) is not None:
                    data[tl_key] = obj.filters[tl_key]

            for filter_key in ("release", "releaseId"):
                if obj.filters.get(camel_to_snake_case(filter_key)):
                    data["filters"][filter_key] = obj.filters[camel_to_snake_case(filter_key)]

            start, end = obj.filters.get("start"), obj.filters.get("end")
            if start and end:
                start, end = parse_timestamp(start), parse_timestamp(end)
                data["expired"], data["start"] = outside_retention_with_modified_start(
                    start, end, obj.organization
                )
                data["end"] = end

        return data
