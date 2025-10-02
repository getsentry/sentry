from typing import Any

from django.db import router

from sentry.api.serializers.base import serialize
from sentry.discover.arithmetic import is_equation, is_equation_alias
from sentry.discover.translation.mep_to_eap import QueryParts, translate_mep_to_eap
from sentry.explore.translation.discover_translation import _format_orderby_for_translation
from sentry.models.dashboard_widget import (
    DashboardWidget,
    DashboardWidgetQuery,
    DashboardWidgetTypes,
    DatasetSourcesTypes,
)
from sentry.search.events.fields import is_function
from sentry.utils.db import atomic_transaction


def snapshot_widget(widget: DashboardWidget):
    if widget.widget_type == DashboardWidgetTypes.TRANSACTION_LIKE or (
        widget.widget_type == DashboardWidgetTypes.DISCOVER
        and widget.discover_widget_split == DashboardWidgetTypes.TRANSACTION_LIKE
    ):
        serialized_widget = serialize(widget)
        serialized_widget["dateCreated"] = serialized_widget["dateCreated"].timestamp()
        widget.widget_snapshot = serialized_widget
        widget.save()


def translate_dashboard_widget(widget: DashboardWidget) -> DashboardWidget:
    snapshot_widget(widget)

    if not widget.widget_snapshot:
        return widget

    transaction_widget = widget.widget_snapshot
    new_widget_queries = []
    dropped_fields_info = []
    for q_index, query in enumerate(transaction_widget["queries"]):
        name = query.get("name", "")
        original_fields = query.get("fields", [])
        orderby = query.get("orderby", "")
        conditions = query.get("conditions", "")
        field_aliases = query.get("fieldAliases", [])
        is_hidden = query.get("isHidden")
        selected_aggregate = query.get("selectedAggregate", None)

        equations = [field for field in original_fields if is_equation(field)]
        other_fields = [field for field in original_fields if not is_equation(field)]

        fields_with_orderby = original_fields[:]
        if orderby and is_equation_alias(orderby):
            fields_with_orderby.append(orderby)

        eap_query_parts, dropped_fields = translate_mep_to_eap(
            QueryParts(
                selected_columns=other_fields,
                query=conditions,
                equations=equations,
                orderby=(
                    _format_orderby_for_translation(orderby, fields_with_orderby)
                    if orderby
                    else None
                ),
            )
        )

        dropped_cols = dropped_fields["selected_columns"]
        dropped_equations = [dropped["equation"] for dropped in dropped_fields["equations"]]

        new_conditions = eap_query_parts["query"] or ""
        new_orderby = eap_query_parts["orderby"][0] if eap_query_parts["orderby"] else ""

        new_fields = []
        new_columns = []
        new_aggregates = []
        new_aliases = []
        new_selected_aggregate = None
        selected_aggregate_field = (
            original_fields[selected_aggregate] if selected_aggregate is not None else None
        )

        col_index = 0
        equation_index = 0
        for old_index, field in enumerate(original_fields):
            is_selected_aggregate = selected_aggregate_field == field
            if field in dropped_cols or field in dropped_equations:
                if is_selected_aggregate:
                    new_selected_aggregate = 0
                continue

            is_equation_field = is_equation(field)
            is_function_field = is_function(field)

            if is_equation_field:
                new_fields.append(eap_query_parts["equations"][equation_index])
                new_aggregates.append(eap_query_parts["equations"][equation_index])
                equation_index += 1

            elif is_function_field:
                new_fields.append(eap_query_parts["selected_columns"][col_index])
                new_aggregates.append(eap_query_parts["selected_columns"][col_index])
                col_index += 1

            else:
                new_fields.append(eap_query_parts["selected_columns"][col_index])
                new_columns.append(eap_query_parts["selected_columns"][col_index])
                col_index += 1

            if is_selected_aggregate:
                new_selected_aggregate = len(new_fields) - 1

            if len(field_aliases) == len(original_fields):
                new_aliases.append(field_aliases[old_index])

        new_widget_queries.append(
            DashboardWidgetQuery(
                widget_id=widget.id,
                order=q_index,
                name=name,
                fields=new_fields,
                conditions=new_conditions,
                aggregates=new_aggregates,
                columns=new_columns,
                field_aliases=new_aliases,
                orderby=new_orderby,
                is_hidden=is_hidden,
                selected_aggregate=new_selected_aggregate,
            )
        )

        dropped_fields_info.append(dropped_fields)

    with atomic_transaction(
        using=(
            router.db_for_write(DashboardWidgetQuery),
            router.db_for_write(DashboardWidget),
        )
    ):
        DashboardWidgetQuery.objects.filter(widget_id=widget.id).delete()
        DashboardWidgetQuery.objects.bulk_create(new_widget_queries)

        widget.widget_type = DashboardWidgetTypes.SPANS
        widget.dataset_source = DatasetSourcesTypes.SPAN_MIGRATION_VERSION_1.value
        widget.changed_reason = dropped_fields_info
        widget.save()

    return widget


def restore_transaction_widget(widget):
    snapshot = widget.widget_snapshot

    if not snapshot or widget.widget_type != DashboardWidgetTypes.SPANS:
        return widget

    queries: list[dict[str, Any]] = snapshot["queries"]

    restored_widget_queries = []
    for order, query_snapshot in enumerate(queries):
        name = query_snapshot.get("name", "")

        fields = query_snapshot.get("fields", [])
        conditions = query_snapshot.get("conditions", "")
        aggregates = query_snapshot.get("aggregates", [])
        columns = query_snapshot.get("columns", [])
        field_aliases = query_snapshot.get("fieldAliases", [])
        orderby = query_snapshot.get("orderby", "")
        is_hidden: bool = query_snapshot.get("isHidden", False)
        selected_aggregate: int | None = query_snapshot.get("selectedAggregate")

        restored_widget_queries.append(
            DashboardWidgetQuery(
                widget_id=widget.id,
                order=order,
                name=name,
                fields=fields,
                conditions=conditions,
                aggregates=aggregates,
                columns=columns,
                field_aliases=field_aliases,
                orderby=orderby,
                is_hidden=is_hidden,
                selected_aggregate=selected_aggregate,
            )
        )

    with atomic_transaction(
        using=(
            router.db_for_write(DashboardWidgetQuery),
            router.db_for_write(DashboardWidget),
        )
    ):
        DashboardWidgetQuery.objects.filter(widget_id=widget.id).delete()
        DashboardWidgetQuery.objects.bulk_create(restored_widget_queries)

        widget.widget_type = DashboardWidgetTypes.TRANSACTION_LIKE
        widget.dataset_source = DatasetSourcesTypes.RESTORED_SPAN_MIGRATION_VERSION_1.value
        widget.changed_reason = None
        widget.save()

    return widget
