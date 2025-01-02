from datetime import timedelta
from functools import partial

from django.utils import timezone
from drf_spectacular.utils import extend_schema
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import eventstore, features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint
from sentry.api.serializers import EventSerializer, SimpleEventSerializer, serialize
from sentry.api.serializers.models.event import SimpleEventSerializerResponse
from sentry.apidocs.constants import RESPONSE_FORBIDDEN, RESPONSE_NOT_FOUND, RESPONSE_UNAUTHORIZED
from sentry.apidocs.examples.event_examples import EventExamples
from sentry.apidocs.parameters import CursorQueryParam, EventParams, GlobalParams
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.models.project import Project
from sentry.snuba.events import Columns
from sentry.types.ratelimit import RateLimit, RateLimitCategory


@extend_schema(tags=["Events"])
@region_silo_endpoint
class ProjectEventsEndpoint(ProjectEndpoint):
    owner = ApiOwner.ISSUES
    publish_status = {
        "GET": ApiPublishStatus.PUBLIC,
    }
    enforce_rate_limit = True
    rate_limits = {
        "GET": {
            RateLimitCategory.IP: RateLimit(limit=60, window=60, concurrent_limit=1),
            RateLimitCategory.USER: RateLimit(limit=60, window=60, concurrent_limit=1),
            RateLimitCategory.ORGANIZATION: RateLimit(limit=60, window=60, concurrent_limit=2),
        }
    }

    @extend_schema(
        operation_id="List a Project's Error Events",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            GlobalParams.PROJECT_ID_OR_SLUG,
            CursorQueryParam,
            EventParams.FULL_PAYLOAD,
            EventParams.SAMPLE,
        ],
        responses={
            200: inline_sentry_response_serializer(
                "ProjectEventsResponseDict", list[SimpleEventSerializerResponse]
            ),
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
        examples=EventExamples.PROJECT_EVENTS_SIMPLE,
    )
    def get(self, request: Request, project: Project) -> Response:
        """
        Return a list of events bound to a project.
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
