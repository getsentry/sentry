from typing import TypedDict

from drf_spectacular.utils import extend_schema
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import eventstore
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.serializers import serialize
from sentry.api.serializers.models.event import EventSerializerResponse
from sentry.apidocs.constants import RESPONSE_NOT_FOUND
from sentry.apidocs.examples.organization_examples import OrganizationExamples
from sentry.apidocs.parameters import GlobalParams
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.types.ratelimit import RateLimit, RateLimitCategory
from sentry.utils.validators import INVALID_ID_DETAILS, is_event_id


class EventIdLookupResponse(TypedDict):
    organizationSlug: str
    projectSlug: str
    groupId: str
    eventId: str
    event: EventSerializerResponse


@region_silo_endpoint
@extend_schema(tags=["Organizations"])
class EventIdLookupEndpoint(OrganizationEndpoint):
    owner = ApiOwner.ISSUES
    publish_status = {
        "GET": ApiPublishStatus.PUBLIC,
    }
    enforce_rate_limit = True
    rate_limits = {
        "GET": {
            RateLimitCategory.IP: RateLimit(limit=1, window=1),
            RateLimitCategory.USER: RateLimit(limit=1, window=1),
            RateLimitCategory.ORGANIZATION: RateLimit(limit=1, window=1),
        }
    }

    @extend_schema(
        operation_id="Resolve an Event ID",
        parameters=[GlobalParams.ORG_ID_OR_SLUG, GlobalParams.EVENT_ID],
        request=None,
        responses={
            200: inline_sentry_response_serializer("EventIdLookupResponse", EventIdLookupResponse),
            404: RESPONSE_NOT_FOUND,
        },
        examples=OrganizationExamples.EVENT_EXAMPLES,
    )
    def get(self, request: Request, organization: Organization, event_id: str) -> Response:
        """
        This resolves an event ID to the project slug and internal issue ID and internal event ID.
        """
        if event_id and not is_event_id(event_id):
            return Response({"detail": INVALID_ID_DETAILS.format("Event ID")}, status=400)

        project_slugs_by_id = dict(
            Project.objects.filter(organization=organization).values_list("id", "slug")
        )

        try:
            snuba_filter = eventstore.Filter(
                conditions=[["event.type", "!=", "transaction"]],
                project_ids=list(project_slugs_by_id.keys()),
                event_ids=[event_id],
            )
            event = eventstore.backend.get_events(
                filter=snuba_filter, limit=1, tenant_ids={"organization_id": organization.id}
            )[0]
        except IndexError:
            raise ResourceDoesNotExist()
        else:
            return Response(
                {
                    "organizationSlug": organization.slug,
                    "projectSlug": project_slugs_by_id[event.project_id],
                    "groupId": str(event.group_id),
                    "eventId": str(event.event_id),
                    "event": serialize(event, request.user),
                }
            )
