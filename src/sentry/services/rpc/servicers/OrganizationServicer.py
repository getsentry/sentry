import logging

from sentry.models.organization import Organization
from sentry.services.rpc.protobufs import Organization_pb2, Organization_pb2_grpc

logger = logging.getLogger(__name__)


class OrganizationModelInterface:
    @classmethod
    def change_name(self, item_id, name):
        organization = Organization.objects.get(id=item_id)
        organization.name = name
        organization.save()
        return organization  # as dataclass


class OrganizationServicer(Organization_pb2_grpc.OrganizationServiceServicer):
    def ChangeName(self, request, context):
        organization = OrganizationModelInterface.change_name(request.item_id, request.name)
        logger.info(
            f"Sucessfully updated organization via request: item_id={request.item_id} request.name={request.name}"
        )
        response = Organization_pb2.Organization(id=organization.id, name=organization.name)
        return response
