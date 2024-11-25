from collections.abc import Sequence
from datetime import datetime, timedelta, timezone
from typing import TYPE_CHECKING

from rest_framework.exceptions import ParseError
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import EnvironmentMixin, region_silo_endpoint
from sentry.api.bases.group import GroupEndpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.helpers.environments import get_environments
from sentry.api.helpers.events import get_query_builder_for_group
from sentry.api.paginator import DateTimePaginator
from sentry.api.serializers import EventAttachmentSerializer, serialize
from sentry.api.utils import get_date_range_from_params
from sentry.exceptions import InvalidParams
from sentry.issues.endpoints.group_events import get_event_search_query
from sentry.models.eventattachment import EventAttachment, event_attachment_screenshot_filter
from sentry.search.events.types import ParamsType

if TYPE_CHECKING:
    from sentry.models.group import Group


def get_event_ids_from_filters(
    request: Request,
    group: Group,
    start: datetime | None,
    end: datetime | None,
) -> Sequence[str] | None:
    default_end = timezone.now()
    default_start = default_end - timedelta(days=90)
    try:
        environments = get_environments(request, group.project.organization)
    except ResourceDoesNotExist:
        environments = None
    query = get_event_search_query(request, group, environments)

    # Exit early if no query or environment is specified
    if not query and not environments:
        return None

    params: ParamsType = {
        "project_id": [group.project_id],
        "organization_id": group.project.organization_id,
        "start": start if start else default_start,
        "end": end if end else default_end,
    }

    if environments:
        params["environment"] = [env.name for env in environments]

    snuba_query = get_query_builder_for_group(
        query=query,
        snuba_params=params,
        group=group,
    )
    referrer = f"api.group-attachments.{group.issue_category.name.lower()}"
    results = snuba_query.run_query(referrer=referrer)
    return [evt["id"] for evt in results["data"]]


@region_silo_endpoint
class GroupAttachmentsEndpoint(GroupEndpoint, EnvironmentMixin):
    publish_status = {
        "GET": ApiPublishStatus.UNKNOWN,
    }

    def get(self, request: Request, group) -> Response:
        """
        List Event Attachments
        ``````````````````````

        Returns a list of event attachments for an issue.

        :pparam string issue_id: the ID of the issue to retrieve.
        :pparam list   types:    a list of attachment types to filter for.
        :auth: required
        """

        if not features.has(
            "organizations:event-attachments", group.project.organization, actor=request.user
        ):
            return self.respond(status=404)

        attachments = EventAttachment.objects.filter(group_id=group.id)

        types = request.GET.getlist("types") or ()
        event_ids = request.GET.getlist("event_id") or ()
        screenshot = "screenshot" in request.GET

        try:
            start, end = get_date_range_from_params(request.GET, optional=True)
        except InvalidParams as e:
            raise ParseError(detail=str(e))

        if start:
            attachments = attachments.filter(date_added__gte=start)
        if end:
            attachments = attachments.filter(date_added__lte=end)

        if not event_ids:
            event_ids = get_event_ids_from_filters(
                request=request,
                group=group,
                start=start,
                end=end,
            )

        if screenshot:
            attachments = event_attachment_screenshot_filter(attachments)
        if types:
            attachments = attachments.filter(type__in=types)
        if event_ids:
            attachments = attachments.filter(event_id__in=event_ids)

        return self.paginate(
            default_per_page=20,
            request=request,
            queryset=attachments,
            order_by="-date_added",
            on_results=lambda x: serialize(x, request.user, EventAttachmentSerializer()),
            paginator_cls=DateTimePaginator,
        )
