# PUT and DELETE specific data forwarder configs

# from rest_framework.request import Request
# from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint, OrganizationPermission


class OrganizationDataForwardingPermission(OrganizationPermission):
    scope_map = {
        "PUT": ["org:write"],
        "DELETE": ["org:write"],
    }


@region_silo_endpoint
class DataForwardingIndexEndpoint(OrganizationEndpoint):
    permission_classes = (OrganizationDataForwardingPermission,)
    owner = ApiOwner.INTEGRATIONS
    publish_status = {
        "PUT": ApiPublishStatus.PRIVATE,
        "DELETE": ApiPublishStatus.PRIVATE,
    }
