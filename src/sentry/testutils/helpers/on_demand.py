from collections.abc import Sequence

from sentry.models.dashboard import Dashboard
from sentry.models.dashboard_widget import (
    DashboardWidget,
    DashboardWidgetDisplayTypes,
    DashboardWidgetQuery,
    DashboardWidgetTypes,
)
from sentry.models.project import Project


def create_widget(
    aggregates: Sequence[str],
    query: str,
    project: Project,
    title: str = "Dashboard",
    id: int | None = None,
    columns: Sequence[str] | None = None,
    dashboard: Dashboard | None = None,
    widget: DashboardWidget | None = None,
    discover_widget_split: int | None = None,
    widget_type: int = DashboardWidgetTypes.DISCOVER,
) -> tuple[DashboardWidgetQuery, DashboardWidget, Dashboard]:
    columns = columns or []
    dashboard = dashboard or Dashboard.objects.create(
        organization=project.organization,
        created_by_id=1,
        title=title,
    )
    order = (id or 1) - 1
    widget = widget or DashboardWidget.objects.create(
        dashboard=dashboard,
        order=order,
        widget_type=widget_type,
        display_type=DashboardWidgetDisplayTypes.LINE_CHART,
        discover_widget_split=discover_widget_split,
    )

    if id:
        widget_query = DashboardWidgetQuery.objects.create(
            id=id,
            aggregates=aggregates,
            conditions=query,
            columns=columns,
            order=order,
            widget=widget,
        )
    else:
        widget_query = DashboardWidgetQuery.objects.create(
            aggregates=aggregates,
            conditions=query,
            columns=columns,
            order=order,
            widget=widget,
        )

    return widget_query, widget, dashboard
