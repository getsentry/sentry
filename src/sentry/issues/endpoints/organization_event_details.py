from collections import defaultdict
from datetime import UTC, datetime, timedelta
from typing import Any

import sentry_sdk
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases import OrganizationEventsEndpointBase
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.serializers import serialize
from sentry.api.serializers.models.event import SqlFormatEventSerializer
from sentry.api.utils import handle_query_errors
from sentry.constants import ObjectStatus
from sentry.models.project import Project
from sentry.search.eap.types import SearchResolverConfig
from sentry.search.events.types import SnubaParams
from sentry.services import eventstore
from sentry.snuba.referrer import Referrer
from sentry.snuba.spans_rpc import Spans
from sentry.utils.sdk import set_span_attribute

VALID_AVERAGE_COLUMNS = {"span.self_time", "span.duration"}


def add_comparison_to_event(event, average_columns):
    if "spans" not in event.data:
        return
    group_to_span_map = defaultdict(list)
    end = datetime.now(UTC)
    start = end - timedelta(hours=24)
    for span in event.data["spans"]:
        group = span.get("sentry_tags", {}).get("group")
        if group is not None:
            group_to_span_map[group].append(span)

    # Nothing to add comparisons to
    set_span_attribute("query.groups", len(group_to_span_map))
    if len(group_to_span_map) == 0:
        return

    with handle_query_errors():
        result = Spans.run_table_query(
            params=SnubaParams(
                start=start,
                end=end,
                projects=[event.project],
                organization=event.organization,
            ),
            query_string=f"span.group:[{','.join(group_to_span_map.keys())}]",
            selected_columns=[
                "span.group",
                *[f"avg({average_column})" for average_column in average_columns],
            ],
            orderby=["span.group"],
            offset=0,
            limit=len(group_to_span_map),
            referrer=Referrer.API_INSIGHTS_ORG_EVENT_AVERAGE_SPAN.value,
            config=SearchResolverConfig(),
            sampling_mode="NORMAL",
        )
        set_span_attribute("query.groups_found", len(result["data"]))
        for row in result["data"]:
            group = row["span.group"]
            for span in group_to_span_map[group]:
                average_results = {}
                for col in row:
                    if col.startswith("avg") and row[col] > 0:
                        average_results[col] = row[col]
                if average_results:
                    span["span.averageResults"] = average_results


@cell_silo_endpoint
class OrganizationEventDetailsEndpoint(OrganizationEventsEndpointBase):
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }

    def convert_args(
        self,
        request: Request,
        organization_id_or_slug: int | str | None = None,
        *args: Any,
        **kwargs: Any,
    ) -> tuple[tuple[Any, ...], dict[str, Any]]:
        args, kwargs = super().convert_args(request, organization_id_or_slug, *args, **kwargs)

        organization = kwargs["organization"]
        project_id_or_slug = kwargs.pop("project_id_or_slug")

        try:
            project = Project.objects.get(
                slug__id_or_slug=project_id_or_slug,
                organization_id=organization.id,
                status=ObjectStatus.ACTIVE,
            )

            kwargs["project"] = project

        except Project.DoesNotExist:
            raise ResourceDoesNotExist

        return args, kwargs

    def get(self, request: Request, organization, project: Project, event_id) -> Response:
        """event_id is validated by a regex in the URL"""
        if not self.has_feature(organization, request):
            return Response(status=404)

        # Check access to the project as this endpoint doesn't use membership checks done
        # get_filter_params().
        if not request.access.has_project_access(project):
            return Response(status=404)

        referrer = request.GET.get("referrer")

        if referrer is not None:
            sentry_sdk.set_tag("referrer", referrer)
            sentry_sdk.set_attribute("referrer", referrer)

        # We return the requested event if we find a match regardless of whether
        # it occurred within the range specified
        with handle_query_errors():
            event = eventstore.backend.get_event_by_id(project.id, event_id)

        if event is None:
            return Response({"detail": "Event not found"}, status=404)

        sentry_sdk.set_attribute("event.type", event.get_event_type())

        average_columns = request.GET.getlist("averageColumn", [])
        if (
            all(col in VALID_AVERAGE_COLUMNS for col in average_columns)
            and len(average_columns) > 0
            and features.has("organizations:insight-modules", organization, actor=request.user)
        ):
            add_comparison_to_event(event=event, average_columns=average_columns)

        # TODO: Remove `for_group` check once performance issues are moved to the issue platform
        if hasattr(event, "for_group") and event.group:
            event = event.for_group(event.group)

        data = serialize(
            event, request.user, SqlFormatEventSerializer(), include_full_release_data=False
        )
        data["projectSlug"] = project.slug

        return Response(data)
