from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases import OrganizationEndpoint
from sentry.models.organization import Organization


@region_silo_endpoint
class OrganizationObjectstoreEndpoint(OrganizationEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
        "PUT": ApiPublishStatus.EXPERIMENTAL,
        "DELETE": ApiPublishStatus.EXPERIMENTAL,
    }
    owner = ApiOwner.FOUNDATIONAL_STORAGE

    def get(self, request: Request, organization: Organization) -> Response:
        if not features.has("organizations:objectstore-endpoint", organization, actor=request.user):
            return Response(status=404)
        # TODO: implement
        return Response(status=200)

    def put(self, request: Request, organization: Organization) -> Response:
        if not features.has("organizations:objectstore-endpoint", organization, actor=request.user):
            return Response(status=404)
        # TODO: implement
        return Response(status=200)

    def delete(self, request: Request, organization: Organization) -> Response:
        if not features.has("organizations:objectstore-endpoint", organization, actor=request.user):
            return Response(status=404)
        # TODO: implement
        return Response(status=200)
