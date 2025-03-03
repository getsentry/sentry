import logging

from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import options
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import Endpoint, region_silo_endpoint
from sentry.auth.elevated_mode import has_elevated_mode
from sentry.backup.crypto import GCPKMSEncryptor, get_default_crypto_key_version
from sentry.relocation.api.endpoints import ERR_FEATURE_DISABLED
from sentry.utils.env import log_gcp_credentials_details

logger = logging.getLogger(__name__)


@region_silo_endpoint
class RelocationPublicKeyEndpoint(Endpoint):
    owner = ApiOwner.OPEN_SOURCE
    publish_status = {
        # TODO(getsentry/team-ospo#214): Stabilize before GA.
        "GET": ApiPublishStatus.EXPERIMENTAL,
    }
    permission_classes = (IsAuthenticated,)

    def get(self, request: Request) -> Response:
        """
        Get your public key for relocation encryption.
        ``````````````````````````````````````````````

        Returns a public key which can be used to create an encrypted export tarball.

        :auth: required
        """

        logger.info("publickeys.relocations.get.start", extra={"caller": request.user.id})

        # We only honor the `relocation.enabled` flag for non-superusers/staff.
        elevated_user = has_elevated_mode(request)
        if not options.get("relocation.enabled") and not elevated_user:
            return Response({"detail": ERR_FEATURE_DISABLED}, status=400)

        # TODO(getsentry/team-ospo#190): We should support per-user keys in the future.
        log_gcp_credentials_details(logger)
        public_key_pem = GCPKMSEncryptor.from_crypto_key_version(
            get_default_crypto_key_version()
        ).get_public_key_pem()

        return Response({"public_key": public_key_pem.decode("utf-8")}, status=200)
