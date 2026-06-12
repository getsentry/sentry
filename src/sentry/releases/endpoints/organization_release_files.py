import logging

from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases.organization import OrganizationReleasesBaseEndpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.serializers.models.release_file import ReleaseFileSerializerResponse
from sentry.apidocs.constants import (
    RESPONSE_BAD_REQUEST,
    RESPONSE_CONFLICT,
    RESPONSE_FORBIDDEN,
    RESPONSE_NOT_FOUND,
    RESPONSE_UNAUTHORIZED,
)
from sentry.apidocs.parameters import CursorQueryParam, GlobalParams, ReleaseParams
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.models.release import Release
from sentry.ratelimits.config import RateLimitConfig
from sentry.releases.endpoints.project_release_files import (
    ReleaseFilesMixin,
    ReleaseFileUploadSerializer,
)
from sentry.types.ratelimit import RateLimit, RateLimitCategory

_FILE_QUERY_PARAM = OpenApiParameter(
    name="query",
    location="query",
    required=False,
    type=str,
    many=True,
    description="If set, only files with these partial names will be returned.",
)
_FILE_CHECKSUM_PARAM = OpenApiParameter(
    name="checksum",
    location="query",
    required=False,
    type=str,
    many=True,
    description="If set, only files with these exact checksums will be returned.",
)


@extend_schema(tags=["Releases"])
@cell_silo_endpoint
class OrganizationReleaseFilesEndpoint(OrganizationReleasesBaseEndpoint, ReleaseFilesMixin):
    owner = ApiOwner.TELEMETRY_EXPERIENCE
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
        "POST": ApiPublishStatus.PRIVATE,
    }

    rate_limits = RateLimitConfig(
        limit_overrides={
            "GET": {
                RateLimitCategory.IP: RateLimit(limit=40, window=1),
                RateLimitCategory.USER: RateLimit(limit=40, window=1),
                RateLimitCategory.ORGANIZATION: RateLimit(limit=40, window=1),
            },
            "POST": {
                RateLimitCategory.IP: RateLimit(limit=40, window=1),
                RateLimitCategory.USER: RateLimit(limit=40, window=1),
                RateLimitCategory.ORGANIZATION: RateLimit(limit=40, window=1),
            },
        }
    )

    @extend_schema(
        operation_id="List an Organization Release's Files",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            ReleaseParams.VERSION,
            _FILE_QUERY_PARAM,
            _FILE_CHECKSUM_PARAM,
            CursorQueryParam,
        ],
        responses={
            200: inline_sentry_response_serializer(
                "ListReleaseFiles", list[ReleaseFileSerializerResponse]
            ),
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
    )
    def get(
        self, request: Request, organization, version
    ) -> Response[list[ReleaseFileSerializerResponse]]:
        """
        Retrieve a list of files for a given release.
        """
        try:
            release = Release.objects.get(organization_id=organization.id, version=version)
        except Release.DoesNotExist:
            raise ResourceDoesNotExist

        if not self.has_release_permission(request, organization, release):
            raise ResourceDoesNotExist

        return self.get_releasefiles(request, release, organization.id)

    @extend_schema(
        operation_id="Upload a New Organization Release File",
        parameters=[GlobalParams.ORG_ID_OR_SLUG, ReleaseParams.VERSION],
        request={"multipart/form-data": ReleaseFileUploadSerializer},
        responses={
            201: inline_sentry_response_serializer(
                "ReleaseFileResponse", ReleaseFileSerializerResponse
            ),
            400: RESPONSE_BAD_REQUEST,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
            409: RESPONSE_CONFLICT,
        },
    )
    def post(
        self, request: Request, organization, version
    ) -> Response[ReleaseFileSerializerResponse]:
        """
        Upload a new file for the given release.

        Files must be uploaded using the `multipart/form-data` content type, against the
        region-specific domain (e.g. `us.sentry.io` or `de.sentry.io`).
        """
        try:
            release = Release.objects.get(organization_id=organization.id, version=version)
        except Release.DoesNotExist:
            raise ResourceDoesNotExist

        logger = logging.getLogger("sentry.files")
        logger.info("organizationreleasefile.start")

        if not self.has_release_permission(
            request, organization, release, require_all_projects=True
        ):
            raise ResourceDoesNotExist

        return self.post_releasefile(request, release, logger)
