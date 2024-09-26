from datetime import timedelta
from functools import partial

from django.utils import timezone
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import eventstore, features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint
from sentry.api.serializers import EventSerializer, SimpleEventSerializer, serialize
from sentry.models.project import Project
from sentry.snuba.events import Columns
from sentry.types.ratelimit import RateLimit, RateLimitCategory


@region_silo_endpoint
class ProjectEventsEndpoint(ProjectEndpoint):
    owner = ApiOwner.ISSUES
    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
    }
    enforce_rate_limit = True
    rate_limits = {
        "GET": {
            RateLimitCategory.IP: RateLimit(limit=60, window=60, concurrent_limit=1),
            RateLimitCategory.USER: RateLimit(limit=60, window=60, concurrent_limit=1),
            RateLimitCategory.ORGANIZATION: RateLimit(limit=60, window=60, concurrent_limit=2),
        }
    }

    def get(self, request: Request, project: Project) -> Response:
        """
        List a Project's Error Events
        ```````````````````````

        Return a list of events bound to a project.

        Note: This endpoint is experimental and may be removed without notice.

        :qparam bool full: if this is set to true then the event payload will
                           include the full event body, including the stacktrace.
                           Set to 1 to enable.

        :qparam bool sample: return events in pseudo-random order. This is deterministic,
                             same query will return the same events in the same order.

        :pparam string organization_id_or_slug: the id or slug of the organization the
                                          groups belong to.
        :pparam string project_id_or_slug: the id or slug of the project the groups
                                     belong to.
        """
        from sentry.api.paginator import GenericOffsetPaginator

        query = request.GET.get("query")
        conditions = []
        if query:
            conditions.append([["positionCaseInsensitive", ["message", f"'{query}'"]], "!=", 0])

        event_filter = eventstore.Filter(conditions=conditions, project_ids=[project.id])
        if features.has(
            "organizations:project-event-date-limit", project.organization, actor=request.user
        ):
            event_filter.start = timezone.now() - timedelta(days=7)

        full = request.GET.get("full", False)
        sample = request.GET.get("sample", False)

        data_fn = partial(
            eventstore.backend.get_events,
            filter=event_filter,
            referrer="api.project-events",
            tenant_ids={"organization_id": project.organization_id},
        )

        if sample:
            # not a true random ordering, but event_id is UUID, that's random enough
            # for our purposes and doesn't have heavy performance impact
            data_fn = partial(data_fn, orderby=[Columns.EVENT_ID.value.alias])

        serializer = EventSerializer() if full else SimpleEventSerializer()
        return self.paginate(
            request=request,
            on_results=lambda results: serialize(results, request.user, serializer),
            paginator=GenericOffsetPaginator(data_fn=data_fn),
        )
