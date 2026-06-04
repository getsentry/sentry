import logging
from datetime import datetime

from drf_spectacular.utils import OpenApiExample, OpenApiParameter, extend_schema
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
_RELEASE_FILE_EXAMPLE: ReleaseFileSerializerResponse = {
    "id": "3",
    "name": "/demo/goodbye.txt",
    "dist": None,
    "headers": {"Content-Type": "text/plain; encoding=utf-8"},
    "size": 15,
    "sha1": "94d6b21e962a9fc65889617ec1f17a1e2fe11b65",
    "dateCreated": datetime.fromisoformat("2018-11-06T21:20:22.894Z"),
}
_LIST_RELEASE_FILES_EXAMPLES = [
    OpenApiExample(
        "Return a list of files for a release",
        value=[_RELEASE_FILE_EXAMPLE],
        response_only=True,
        status_codes=["200"],
    )
]
_UPLOAD_RELEASE_FILE_EXAMPLES = [
    OpenApiExample(
        "Upload a release file",
        value={
            "name": "/demo/release.min.js",
            "file": "release.min.js",
        },
        request_only=True,
        media_type="multipart/form-data",
    )
]
_UPLOAD_ORGANIZATION_RELEASE_FILE_DESCRIPTION = """
Upload a new file for the given release.

Unlike other API requests, files must be uploaded using the traditional multipart/form-data
content type.

Requests to this endpoint should use the region-specific domain, e.g. `us.sentry.io` or
`de.sentry.io`.

The optional `name` attribute should reflect the absolute path that this file will be
referenced as. For example, in the case of JavaScript you might specify the full web URI.
""".strip()


@extend_schema(tags=["Releases"])
@cell_silo_endpoint
class OrganizationReleaseFilesEndpoint(OrganizationReleasesBaseEndpoint, ReleaseFilesMixin):
    owner = ApiOwner.TELEMETRY_EXPERIENCE
    method_servers = {
        "POST": [{"url": "https://{region}.sentry.io"}],
    }
    publish_status = {
        "GET": ApiPublishStatus.PUBLIC,
        "POST": ApiPublishStatus.PUBLIC,
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
        operation_id="List an Organization's Release Files",
        description="Return a list of files for a given release.",
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
        examples=_LIST_RELEASE_FILES_EXAMPLES,
    )
    def get(
        self, request: Request, organization, version
    ) -> Response[list[ReleaseFileSerializerResponse]]:
        try:
            release = Release.objects.get(organization_id=organization.id, version=version)
        except Release.DoesNotExist:
            raise ResourceDoesNotExist

        if not self.has_release_permission(request, organization, release):
            raise ResourceDoesNotExist

        return self.get_releasefiles(request, release, organization.id)

    @extend_schema(
        operation_id="Upload a New Organization Release File",
        description=_UPLOAD_ORGANIZATION_RELEASE_FILE_DESCRIPTION,
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
        examples=_UPLOAD_RELEASE_FILE_EXAMPLES,
    )
    def post(
        self, request: Request, organization, version
    ) -> Response[ReleaseFileSerializerResponse]:
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
