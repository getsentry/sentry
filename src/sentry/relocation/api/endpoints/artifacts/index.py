import logging

from rest_framework.exceptions import PermissionDenied
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import Endpoint, region_silo_endpoint
from sentry.api.exceptions import ResourceDoesNotExist, StaffRequired, SuperuserRequired
from sentry.api.permissions import SuperuserOrStaffFeatureFlaggedPermission
from sentry.auth.elevated_mode import has_elevated_mode
from sentry.auth.staff import has_staff_option
from sentry.models.files.utils import get_relocation_storage
from sentry.relocation.models.relocation import Relocation

ERR_NEED_RELOCATION_ADMIN = (
    "Cannot view relocation artifacts, as you do not have the appropriate permissions."
)

logger = logging.getLogger(__name__)


@region_silo_endpoint
class RelocationArtifactIndexEndpoint(Endpoint):
    owner = ApiOwner.HYBRID_CLOUD
    publish_status = {
        # TODO(getsentry/team-ospo#214): Stabilize before GA.
        "GET": ApiPublishStatus.EXPERIMENTAL,
    }
    permission_classes = (SuperuserOrStaffFeatureFlaggedPermission,)

    def get(self, request: Request, relocation_uuid: str) -> Response:
        """
        Lists all relocation bucket files associated with a relocation
        ``````````````````````````````````````````````````

        :pparam string relocation_uuid: a UUID identifying the relocation.

        :auth: required
        """

        logger.info("relocations.artifact.index.get.start", extra={"caller": request.user.id})

        # TODO(schew2381): Remove the superuser reference below after feature flag is removed.
        # Must be superuser/staff AND have a `UserPermission` of `relocation.admin` to see access!
        if not has_elevated_mode(request):
            if has_staff_option(request.user):
                raise StaffRequired
            raise SuperuserRequired

        if not request.access.has_permission("relocation.admin"):
            raise PermissionDenied(ERR_NEED_RELOCATION_ADMIN)

        try:
            relocation: Relocation = Relocation.objects.get(uuid=relocation_uuid)
        except Relocation.DoesNotExist:
            raise ResourceDoesNotExist

        relocation_storage = get_relocation_storage()
        (dirs, files) = relocation_storage.listdir(f"runs/{relocation.uuid}")

        # Only check one level deep - no need to recurse.
        for dir in dirs:
            (_, dir_files) = relocation_storage.listdir(f"runs/{relocation.uuid}/{dir}")
            files += [f"{dir}/{file}" for file in dir_files]

        # TODO(azaslavsky): We should use a cleverer, asynchronous way to get all these sizes.
        file_metadata = [
            {"path": f, "bytes": relocation_storage.size(f"runs/{relocation.uuid}/{f}")}
            for f in sorted(files)
        ]
        return self.respond({"files": file_metadata})
