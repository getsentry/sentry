from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization import (
    OrganizationEndpoint,
    OrganizationIntegrationsLoosePermission,
)
from sentry.issues.auto_source_code_config.derived_code_mappings_endpoint import (
    process_get_request,
    process_post_request,
)
from sentry.models.organization import Organization


@region_silo_endpoint
class OrganizationDeriveCodeMappingsEndpoint(OrganizationEndpoint):
    """
    In the UI, we have a prompt to derive code mappings from the stacktrace filename.
    This endpoint is used to get the possible code mappings for it.
    """

    owner = ApiOwner.ISSUES
    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
        "POST": ApiPublishStatus.EXPERIMENTAL,
    }
    permission_classes = (OrganizationIntegrationsLoosePermission,)

    def get(self, request: Request, organization: Organization) -> Response:
        """
        Get all files from the customer repositories that match a stack trace frame.
        ``````````````````

        :param organization:
        :param string absPath:
        :param string module:
        :param string stacktraceFilename:
        :param string platform:
        :auth: required
        """
        return process_get_request(request, organization)

    def post(self, request: Request, organization: Organization) -> Response:
        """
        Create a new repository project path config
        ``````````````````

        :param organization:
        :param int projectId:
        :param string repoName:
        :param string defaultBranch:
        :param string stackRoot:
        :param string sourceRoot:
        :auth: required
        """
        return process_post_request(request, organization)
