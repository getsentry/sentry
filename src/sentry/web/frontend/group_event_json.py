from django.http import Http404, HttpRequest, HttpResponse
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, extend_schema

from sentry import eventstore
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.apidocs.constants import RESPONSE_NOT_FOUND
from sentry.apidocs.examples.event_examples import GROUP_EVENT
from sentry.models.group import Group, get_group_with_redirect
from sentry.models.groupmeta import GroupMeta
from sentry.utils import json
from sentry.web.frontend.base import OrganizationView, region_silo_view


@extend_schema(tags=["Events"])
@region_silo_view
class GroupEventJsonView(OrganizationView):
    publish_status = {
        "GET": ApiPublishStatus.PUBLIC,
    }
    owner = ApiOwner.ISSUES
    required_scope = "event:read"

    @extend_schema(
        operation_id="Retrieve the JSON object for an Event",
        description="Returns the JSON object for an event.",
        parameters=[
            OpenApiParameter(
                name="event_id_or_latest",
                location=OpenApiParameter.PATH,
                type=OpenApiTypes.STR,
                description="The ID of the event to retrieve, or 'latest' for the most recent event.",
                required=True,
            ),
        ],
        responses={
            200: OpenApiTypes.OBJECT,
            404: RESPONSE_NOT_FOUND,
        },
        examples=[GROUP_EVENT],
    )
    def get(self, request: HttpRequest, organization, group_id, event_id_or_latest) -> HttpResponse:
        """
        Retrieve the JSON object for an Event
        """
        try:
            # TODO(tkaemming): This should *actually* redirect, see similar
            # comment in ``GroupEndpoint.convert_args``.
            group, _ = get_group_with_redirect(group_id)
        except Group.DoesNotExist:
            raise Http404

        if event_id_or_latest == "latest":
            event = group.get_latest_event()
        else:
            event = eventstore.backend.get_event_by_id(
                group.project.id, event_id_or_latest, group_id=group.id
            )

        if event is None:
            raise Http404

        GroupMeta.objects.populate_cache([group])

        return HttpResponse(json.dumps(event.as_dict()), content_type="application/json")
