import logging
from typing import Any

import orjson
from cryptography.fernet import Fernet
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
from sentry.backup.crypto import (
    CryptoKeyVersion,
    GCPKMSDecryptor,
    get_default_crypto_key_version,
    unwrap_encrypted_export_tarball,
)
from sentry.models.files.utils import get_relocation_storage
from sentry.models.relocation import Relocation

ERR_NEED_RELOCATION_ADMIN = (
    "Cannot view relocation artifacts, as you do not have the appropriate permissions."
)

logger = logging.getLogger(__name__)


def _orjson_default(obj: Any) -> Any:
    if isinstance(obj, CryptoKeyVersion):
        return obj._asdict()
    raise TypeError


@region_silo_endpoint
class RelocationArtifactDetailsEndpoint(Endpoint):
    owner = ApiOwner.DEV_INFRA
    publish_status = {
        # TODO(getsentry/team-ospo#214): Stabilize before GA.
        "GET": ApiPublishStatus.EXPERIMENTAL,
    }
    permission_classes = (SuperuserOrStaffFeatureFlaggedPermission,)

    def get(
        self, request: Request, relocation_uuid: str, artifact_kind: str, file_name: str
    ) -> Response:
        """
        Get a single relocation artifact.
        ``````````````````````````````````````````````````

        :pparam string relocation_uuid: a UUID identifying the relocation.
        :pparam string artifact_kind: one of `conf` | `in` | `out` | `findings`.
        :pparam string file_name: The name of the file itself.

        :auth: required
        """

        logger.info("relocations.artifact.details.get.start", extra={"caller": request.user.id})

        # TODO(schew2381): Remove the superuser reference below after feature flag is removed.
        # Must be superuser/staff AND have a `UserPermission` of `relocation.admin` to see access!
        if not has_elevated_mode(request):
            if has_staff_option(request.user):
                raise StaffRequired
            raise SuperuserRequired

        if not request.access.has_permission("relocation.admin"):
            raise PermissionDenied(
                "Cannot view relocation artifacts, as you do not have the appropriate permissions."
            )

        try:
            relocation: Relocation = Relocation.objects.get(uuid=relocation_uuid)
        except Relocation.DoesNotExist:
            raise ResourceDoesNotExist

        file_path = f"runs/{relocation.uuid}/{artifact_kind}/{file_name}"
        relocation_storage = get_relocation_storage()
        if not relocation_storage.exists(file_path):
            raise ResourceDoesNotExist

        # TODO(azaslavsky): We can probably get all clever and stream these files, but it's not
        # necessary for now.
        with relocation_storage.open(file_path) as fp:
            if not file_name.endswith(".tar"):
                return self.respond({"contents": fp.read()})

            unwrapped = unwrap_encrypted_export_tarball(fp)
            decryptor = GCPKMSDecryptor.from_bytes(
                orjson.dumps(get_default_crypto_key_version(), default=_orjson_default)
            )
            plaintext_data_encryption_key = decryptor.decrypt_data_encryption_key(unwrapped)
            fernet = Fernet(plaintext_data_encryption_key)
            return self.respond(
                {"contents": fernet.decrypt(unwrapped.encrypted_json_blob).decode()}
            )
