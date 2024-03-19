from collections import defaultdict
from datetime import datetime, timedelta

from rest_framework.request import Request
from rest_framework.response import Response
from snuba_sdk import Column, Condition, Function, Op

from sentry import eventstore
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases import OrganizationEventsEndpointBase
from sentry.api.serializers import serialize
from sentry.api.serializers.models.event import SqlFormatEventSerializer
from sentry.api.utils import handle_query_errors
from sentry.constants import ObjectStatus
from sentry.models.project import Project
from sentry.search.events.builder import SpansMetricsQueryBuilder
from sentry.snuba.dataset import Dataset


def add_comparison_to_event(event, average_column):
    if "spans" not in event.data:
        return
    group_to_span_map = defaultdict(list)
    end = datetime.now()
    start = end - timedelta(hours=24)
    for span in event.data["spans"]:
        group = span.get("sentry_tags", {}).get("group")
        if group is not None:
            group_to_span_map[group].append(span)

    # Nothing to add comparisons to
    if len(group_to_span_map) == 0:
        return

    with handle_query_errors():
        builder = SpansMetricsQueryBuilder(
            dataset=Dataset.PerformanceMetrics,
            params={
                "start": start,
                "end": end,
                "project_objects": [event.project],
                "organization_id": event.organization.id,
            },
            selected_columns=[
                "group",
                f"avg({average_column}) as avg",
            ],
            # orderby shouldn't matter, just picking something so results are consistent
            orderby=["group"],
        )
        builder.add_conditions(
            [
                Condition(
                    Column(builder.resolve_column_name("group")),
                    Op.IN,
                    Function("tuple", list(group_to_span_map.keys())),
                )
            ]
        )
        result = builder.run_query("Get avg for spans")
        for result in result["data"]:
            group = result["group"]
            avg = result["avg"]
            for span in group_to_span_map[group]:
                span["span.average_time"] = avg


@region_silo_endpoint
class OrganizationEventDetailsEndpoint(OrganizationEventsEndpointBase):
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }

    def get(self, request: Request, organization, project_slug, event_id) -> Response:
        """event_id is validated by a regex in the URL"""
        if not self.has_feature(organization, request):
            return Response(status=404)

        try:
            project = Project.objects.get(
                slug=project_slug, organization_id=organization.id, status=ObjectStatus.ACTIVE
            )
        except Project.DoesNotExist:
            return Response(status=404)

        # Check access to the project as this endpoint doesn't use membership checks done
        # get_filter_params().
        if not request.access.has_project_access(project):
            return Response(status=404)

        # We return the requested event if we find a match regardless of whether
        # it occurred within the range specified
        with handle_query_errors():
            event = eventstore.backend.get_event_by_id(project.id, event_id)

        if event is None:
            return Response({"detail": "Event not found"}, status=404)

        average_column = request.GET.get("averageColumn")
        if average_column in ["span.self_time"]:
            add_comparison_to_event(event, average_column)

        # TODO: Remove `for_group` check once performance issues are moved to the issue platform
        if hasattr(event, "for_group") and event.group:
            event = event.for_group(event.group)

        data = serialize(
            event, request.user, SqlFormatEventSerializer(), include_full_release_data=False
        )
        data["projectSlug"] = project_slug

        return Response(data)
