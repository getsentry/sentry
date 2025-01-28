from rest_framework.request import Request
from rest_framework.response import Response

from sentry import eventstore
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.serializers import serialize
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.types.ratelimit import RateLimit, RateLimitCategory
from sentry.utils.validators import INVALID_ID_DETAILS, is_event_id


@region_silo_endpoint
class EventIdLookupEndpoint(OrganizationEndpoint):
    owner = ApiOwner.ISSUES
    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
    }
    enforce_rate_limit = True
    rate_limits = {
        "GET": {
            RateLimitCategory.IP: RateLimit(limit=1, window=1),
            RateLimitCategory.USER: RateLimit(limit=1, window=1),
            RateLimitCategory.ORGANIZATION: RateLimit(limit=1, window=1),
        }
    }

    def get(self, request: Request, organization: Organization, event_id: str) -> Response:
        """
        Resolve an Event ID
        ``````````````````

        This resolves an event ID to the project slug and internal issue ID and internal event ID.

        :pparam string organization_id_or_slug: the id or slug of the organization the
                                          event ID should be looked up in.
        :param string event_id: the event ID to look up. validated by a
                                regex in the URL.
        :auth: required
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
