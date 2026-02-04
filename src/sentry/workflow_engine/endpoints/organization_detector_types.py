from drf_spectacular.utils import extend_schema
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases import OrganizationEndpoint
from sentry.api.paginator import OffsetPaginator
from sentry.apidocs.constants import (
    RESPONSE_BAD_REQUEST,
    RESPONSE_FORBIDDEN,
    RESPONSE_NOT_FOUND,
    RESPONSE_UNAUTHORIZED,
)
from sentry.apidocs.parameters import GlobalParams
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.issues import grouptype
from sentry.models.organization import Organization


@region_silo_endpoint
class OrganizationDetectorTypeIndexEndpoint(OrganizationEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
    }
    owner = ApiOwner.ISSUES

    @extend_schema(
        operation_id="Fetch Detector Types",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
        ],
        responses={
            201: inline_sentry_response_serializer("ListDetectorTypes", list[str]),
            400: RESPONSE_BAD_REQUEST,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
    )
    def get(self, request: Request, organization: Organization) -> Response:
        """
        Returns a list of detector types for a given org
        """
        type_slugs = [
            gt.slug
            for gt in grouptype.registry.get_visible(organization)
            if gt.detector_settings is not None and gt.detector_settings.handler is not None
        ]
        type_slugs.sort()

        return self.paginate(
            request=request,
            queryset=type_slugs,
            paginator_cls=OffsetPaginator,
        )
