import logging

from sentry.models.organization import Organization
from sentry.services.rpc.protobufs import Organization_pb2, Organization_pb2_grpc

logger = logging.getLogger(__name__)


class OrganizationServicer(Organization_pb2_grpc.OrganizationServiceServicer):
    def ChangeName(self, request, context):
        organization = Organization.objects.get(id=request.item_id)
        organization.name = request.name
        organization.save()
        logger.info(
            f"Sucessfully updated organization via request: item_id={request.item_id} request.name={request.name}"
        )
        response = Organization_pb2.Organization(id=organization.id, name=organization.name)
        return response
