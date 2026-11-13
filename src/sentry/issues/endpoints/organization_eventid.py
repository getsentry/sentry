from typing import Annotated, TypedDict

import sentry_sdk
from drf_spectacular.utils import extend_schema
from rest_framework.request import Request
from rest_framework.response import Response
from sentry_protos.snuba.v1.trace_item_attribute_pb2 import AttributeKey, AttributeValue
from sentry_protos.snuba.v1.trace_item_filter_pb2 import ComparisonFilter, TraceItemFilter

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import DEFAULT_DURATION_BUDGET, cell_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.serializers import serialize
from sentry.api.serializers.models.event import EventSerializerResponse
from sentry.apidocs.constants import (
    RESPONSE_BAD_REQUEST,
    RESPONSE_FORBIDDEN,
    RESPONSE_NOT_FOUND,
    RESPONSE_UNAUTHORIZED,
)
from sentry.apidocs.descriptions import ApiDescription
from sentry.apidocs.examples.organization_examples import OrganizationExamples
from sentry.apidocs.parameters import GlobalParams
from sentry.apidocs.response_types import DetailResponse
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.models.organization import Organization
from sentry.ratelimits.config import RateLimitConfig
from sentry.search.eap.occurrences.query_utils import build_event_id_in_filter
from sentry.search.eap.rpc_utils import and_trace_item_filters
from sentry.services import eventstore
from sentry.types.ratelimit import RateLimit, RateLimitCategory
from sentry.utils.validators import INVALID_ID_DETAILS, is_event_id


class EventIdLookupResponse(TypedDict):
    organizationSlug: Annotated[str, ApiDescription("Slug of the organization")]
    projectSlug: Annotated[str, ApiDescription("Slug of the event's project")]
    groupId: Annotated[str, ApiDescription("ID of the event's issue")]
    eventId: Annotated[str, ApiDescription("ID of the event")]
    event: Annotated[EventSerializerResponse, ApiDescription("The event")]


@cell_silo_endpoint
@extend_schema(tags=["Organizations"])
class EventIdLookupEndpoint(OrganizationEndpoint):
    owner = ApiOwner.ISSUES
    max_acceptable_duration = DEFAULT_DURATION_BUDGET
    publish_status = {
        "GET": ApiPublishStatus.PUBLIC,
    }
    enforce_rate_limit = True
    rate_limits = RateLimitConfig(
        limit_overrides={
            "GET": {
                RateLimitCategory.IP: RateLimit(limit=1, window=1),
                RateLimitCategory.USER: RateLimit(limit=1, window=1),
                RateLimitCategory.ORGANIZATION: RateLimit(limit=1, window=1),
            }
        }
    )

    @extend_schema(
        operation_id="resolveOrganizationEventId",
        summary="Resolve an Event ID",
        parameters=[GlobalParams.ORG_ID_OR_SLUG, GlobalParams.EVENT_ID],
        request=None,
        responses={
            200: inline_sentry_response_serializer("EventIdLookupResponse", EventIdLookupResponse),
            400: RESPONSE_BAD_REQUEST,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
        examples=OrganizationExamples.EVENT_EXAMPLES,
    )
    def get(
        self, request: Request, organization: Organization, event_id: str
    ) -> Response[EventIdLookupResponse] | Response[DetailResponse]:
        """
        Resolve an event ID to its project slug, issue ID, and event details. Only projects the
        caller can access are searched.
        """
        if event_id and not is_event_id(event_id):
            return Response({"detail": INVALID_ID_DETAILS.format("Event ID")}, status=400)

        # Scope to projects the caller can access; the endpoint's org-level
        # permission_classes only check org membership, not project access.
        projects = self.get_projects(request, organization, include_all_accessible=True)
        project_slugs_by_id = {project.id: project.slug for project in projects}

        if not project_slugs_by_id:
            raise ResourceDoesNotExist()

        try:
            snuba_filter = eventstore.Filter(
                conditions=[["event.type", "!=", "transaction"]],
                project_ids=list(project_slugs_by_id.keys()),
                event_ids=[event_id],
            )
            eap_conditions = and_trace_item_filters(
                build_event_id_in_filter([event_id]),
                TraceItemFilter(
                    comparison_filter=ComparisonFilter(
                        key=AttributeKey(name="type", type=AttributeKey.TYPE_STRING),
                        op=ComparisonFilter.OP_NOT_EQUALS,
                        value=AttributeValue(val_str="transaction"),
                    )
                ),
            )
            event = eventstore.backend.get_events(
                filter=snuba_filter,
                eap_conditions=eap_conditions,
                limit=1,
                tenant_ids={"organization_id": organization.id},
            )[0]
        except IndexError:
            raise ResourceDoesNotExist()
        else:
            sentry_sdk.set_attribute("event.type", event.get_event_type())
            return Response(
                {
                    "organizationSlug": organization.slug,
                    "projectSlug": project_slugs_by_id[event.project_id],
                    "groupId": str(event.group_id),
                    "eventId": str(event.event_id),
                    "event": serialize(event, request.user),
                }
            )
