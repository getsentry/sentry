from __future__ import absolute_import

from django.db.models import Max
from rest_framework import serializers

from sentry.api.serializers.rest_framework import CamelSnakeSerializer
from sentry.api.event_search import (
    resolve_field_list,
    get_filter,
    InvalidSearchQuery,
)
from sentry.models import (
    DashboardWidget,
    DashboardWidgetQuery,
    DashboardWidgetDisplayTypes,
)
from sentry.utils.dates import parse_stats_period


def get_next_dashboard_order(dashboard_id):
    max_order = DashboardWidget.objects.filter(dashboard_id=dashboard_id).aggregate(Max("order"))[
        "order__max"
    ]

    return max_order + 1 if max_order else 1


def get_next_query_order(widget_id):
    max_order = DashboardWidgetQuery.objects.filter(widget_id=widget_id).aggregate(Max("order"))[
        "order__max"
    ]

    return max_order + 1 if max_order else 1


def validate_id(self, value):
    try:
        return int(value)
    except ValueError:
        raise serializers.ValidationError("Invalid ID format. Must be a numeric string")


class DashboardWidgetQuerySerializer(CamelSnakeSerializer):
    # Is a string because output serializers also make it a string.
    id = serializers.CharField(required=False)
    fields = serializers.ListField(child=serializers.CharField(), required=False)
    name = serializers.CharField(required=False, allow_blank=True)
    conditions = serializers.CharField(required=False)

    required_for_create = {"fields", "conditions"}

    validate_id = validate_id

    def validate_fields(self, fields):
        snuba_filter = get_filter("")
        try:
            resolve_field_list(fields, snuba_filter)
            return fields
        except InvalidSearchQuery as err:
            raise serializers.ValidationError(u"Invalid fields: {}".format(err))

    def validate_conditions(self, conditions):
        try:
            get_filter(conditions)
        except InvalidSearchQuery as err:
            raise serializers.ValidationError(u"Invalid conditions: {}".format(err))
        return conditions

    def validate(self, data):
        if not data.get("id"):
            keys = set(data.keys())
            if keys.intersection(self.required_for_create) != self.required_for_create:
                raise serializers.ValidationError("The fields and conditions fields are required")
        return data


class DashboardWidgetSerializer(CamelSnakeSerializer):
    # Is a string because output serializers also make it a string.
    id = serializers.CharField(required=False)
    title = serializers.CharField(required=False)
    display_type = serializers.ChoiceField(
        choices=DashboardWidgetDisplayTypes.as_text_choices(), required=False
    )
    interval = serializers.CharField(required=False)
    queries = DashboardWidgetQuerySerializer(many=True, required=False)

    def validate_display_type(self, display_type):
        return DashboardWidgetDisplayTypes.get_id_for_type_name(display_type)

    validate_id = validate_id

    def validate_interval(self, interval):
        if parse_stats_period(interval) is None:
            raise serializers.ValidationError("Invalid interval")
        return interval

    def validate(self, data):
        if not data.get("id") and not data.get("queries"):
            raise serializers.ValidationError("One or more queries are required to create a widget")
        return data


class DashboardDetailsSerializer(CamelSnakeSerializer):
    # Is a string because output serializers also make it a string.
    id = serializers.CharField(required=False)
    title = serializers.CharField(required=False)
    widgets = DashboardWidgetSerializer(many=True, required=False)

    validate_id = validate_id

    def update(self, instance, validated_data):
        """
        Update a dashboard, the connected widgets and queries

        - Widgets in the dashboard currently, but not in validated_data will be removed.
        - Widgets without ids will be created.
        - Widgets with matching IDs will be updated.
        - The order of the widgets will be updated based on the order in the request data.

        Only call save() on this serializer from within a transaction or
        bad things will happen
        """
        instance.title = validated_data.get("title", instance.title)
        instance.save()

        if "widgets" in validated_data:
            self.update_widgets(instance, validated_data["widgets"])

        return instance

    def update_widgets(self, instance, widget_data):
        widget_ids = [widget["id"] for widget in widget_data if "id" in widget]

        existing_widgets = DashboardWidget.objects.filter(dashboard=instance, id__in=widget_ids)
        existing_map = {widget.id: widget for widget in existing_widgets}

        # Remove widgets that are not in the current request.
        self.remove_missing_widgets(instance.id, widget_ids)

        # Get new ordering start point to avoid constraint errors
        next_order = get_next_dashboard_order(instance.id)

        for i, data in enumerate(widget_data):
            widget_id = data.get("id")
            if widget_id and widget_id in existing_map:
                # Update existing widget.
                self.update_widget(existing_map[widget_id], data, next_order + i)
            elif not widget_id:
                # Create a new widget.
                self.create_widget(instance, data, next_order + i)
            else:
                raise serializers.ValidationError(
                    "You cannot update widgets that are not part of this dashboard."
                )

    def remove_missing_widgets(self, dashboard_id, keep_ids):
        """
        Removes current widgets belonging to dashboard not in keep_ids.
        """
        DashboardWidget.objects.filter(dashboard_id=dashboard_id).exclude(id__in=keep_ids).delete()

    def create_widget(self, dashboard, widget_data, order):
        widget = DashboardWidget.objects.create(
            dashboard=dashboard,
            display_type=widget_data["display_type"],
            title=widget_data["title"],
            interval=widget_data.get("interval", "5m"),
            order=order,
        )
        new_queries = []
        for i, query in enumerate(widget_data.pop("queries")):
            new_queries.append(
                DashboardWidgetQuery(
                    widget=widget,
                    fields=query["fields"],
                    conditions=query["conditions"],
                    name=query.get("name", ""),
                    order=i,
                )
            )
        DashboardWidgetQuery.objects.bulk_create(new_queries)

    def update_widget(self, widget, data, order):
        widget.title = data.get("title", widget.title)
        widget.display_type = data.get("display_type", widget.display_type)
        widget.interval = data.get("interval", widget.interval)
        widget.order = order
        widget.save()

        if "queries" in data:
            self.update_widget_queries(widget, data["queries"])

    def update_widget_queries(self, widget, data):
        query_ids = [query["id"] for query in data if "id" in query]
        self.remove_missing_queries(widget.id, query_ids)

        existing = DashboardWidgetQuery.objects.filter(widget=widget, id__in=query_ids)
        existing_map = {query.id: query for query in existing}

        # Get new ordering start point to avoid constraint errors
        next_order = get_next_query_order(widget.id)

        new_queries = []
        for i, query_data in enumerate(data):
            query_id = query_data.get("id")
            if query_id and query_id in existing_map:
                self.update_widget_query(existing_map[query_id], query_data, next_order + i)
            if not query_id:
                new_queries.append(
                    DashboardWidgetQuery(
                        widget=widget,
                        fields=query_data["fields"],
                        conditions=query_data["conditions"],
                        name=query_data.get("name", ""),
                        order=next_order + i,
                    )
                )
        DashboardWidgetQuery.objects.bulk_create(new_queries)

    def update_widget_query(self, query, data, order):
        query.name = data.get("name", query.name)
        query.fields = data.get("fields", query.fields)
        query.conditions = data.get("conditions", query.conditions)
        query.order = order
        query.save()

    def remove_missing_queries(self, widget_id, keep_ids):
        DashboardWidgetQuery.objects.filter(widget_id=widget_id).exclude(id__in=keep_ids).delete()
