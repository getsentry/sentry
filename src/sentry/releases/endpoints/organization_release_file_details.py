from datetime import datetime

from django.http.response import FileResponse
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
    RESPONSE_FORBIDDEN,
    RESPONSE_NO_CONTENT,
    RESPONSE_NOT_FOUND,
    RESPONSE_UNAUTHORIZED,
)
from sentry.apidocs.parameters import GlobalParams, ReleaseParams
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.models.organization import Organization
from sentry.models.release import Release
from sentry.releases.endpoints.project_release_file_details import (
    ReleaseFileDetailsMixin,
    ReleaseFileSerializer,
)

_RETRIEVE_RELEASE_FILE_EXAMPLE: ReleaseFileSerializerResponse = {
    "id": "1",
    "name": "/demo/message-for-you.txt",
    "dist": None,
    "headers": {"Content-Type": "text/plain; encoding=utf-8"},
    "size": 12,
    "sha1": "2ef7bde608ce5404e97d5f042f95f89f1c232871",
    "dateCreated": datetime.fromisoformat("2018-11-06T21:20:19.150Z"),
}
_UPDATE_RELEASE_FILE_EXAMPLE: ReleaseFileSerializerResponse = {
    "id": "3",
    "name": "/demo/goodbye.txt",
    "dist": None,
    "headers": {"Content-Type": "text/plain; encoding=utf-8"},
    "size": 15,
    "sha1": "94d6b21e962a9fc65889617ec1f17a1e2fe11b65",
    "dateCreated": datetime.fromisoformat("2018-11-06T21:20:22.894Z"),
}
_RETRIEVE_RELEASE_FILE_EXAMPLES = [
    OpenApiExample(
        "Retrieve a release file",
        value=_RETRIEVE_RELEASE_FILE_EXAMPLE,
        response_only=True,
        status_codes=["200"],
    )
]
_UPDATE_RELEASE_FILE_EXAMPLES = [
    OpenApiExample(
        "Update a release file",
        value={"name": "/demo/goodbye.txt"},
        request_only=True,
    ),
    OpenApiExample(
        "Return an updated release file",
        value=_UPDATE_RELEASE_FILE_EXAMPLE,
        response_only=True,
        status_codes=["200"],
    ),
]


@extend_schema(tags=["Releases"])
@cell_silo_endpoint
class OrganizationReleaseFileDetailsEndpoint(
    OrganizationReleasesBaseEndpoint, ReleaseFileDetailsMixin
):
    owner = ApiOwner.TELEMETRY_EXPERIENCE
    publish_status = {
        "DELETE": ApiPublishStatus.PUBLIC,
        "GET": ApiPublishStatus.PUBLIC,
        "PUT": ApiPublishStatus.PUBLIC,
    }

    @extend_schema(
        operation_id="Retrieve an Organization Release's File",
        description="Retrieve a file for a given release.",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            ReleaseParams.VERSION,
            ReleaseParams.FILE_ID,
            OpenApiParameter(
                name="download",
                location="query",
                required=False,
                type=bool,
                description=(
                    "If this is set to true, then the response payload will be the raw "
                    "file contents. Otherwise, the response will be the file metadata as JSON."
                ),
            ),
        ],
        responses={
            200: inline_sentry_response_serializer(
                "ReleaseFileResponse", ReleaseFileSerializerResponse
            ),
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
        examples=_RETRIEVE_RELEASE_FILE_EXAMPLES,
    )
    def get(
        self, request: Request, organization, version, file_id
    ) -> Response[ReleaseFileSerializerResponse] | Response[None] | FileResponse:
        try:
            release = Release.objects.get(organization_id=organization.id, version=version)
        except Release.DoesNotExist:
            raise ResourceDoesNotExist

        if not self.has_release_permission(request, organization, release):
            raise ResourceDoesNotExist

        return self.get_releasefile(
            request,
            release,
            file_id,
            check_permission_fn=lambda: request.access.has_scope("project:write"),
        )

    @extend_schema(
        operation_id="Update an Organization Release File",
        description="Update an organization release file.",
        parameters=[GlobalParams.ORG_ID_OR_SLUG, ReleaseParams.VERSION, ReleaseParams.FILE_ID],
        request=ReleaseFileSerializer,
        responses={
            200: inline_sentry_response_serializer(
                "ReleaseFileResponse", ReleaseFileSerializerResponse
            ),
            400: RESPONSE_BAD_REQUEST,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
        examples=_UPDATE_RELEASE_FILE_EXAMPLES,
    )
    def put(
        self, request: Request, organization: Organization, version, file_id
    ) -> Response[ReleaseFileSerializerResponse]:
        try:
            release = Release.objects.get(organization_id=organization.id, version=version)
        except Release.DoesNotExist:
            raise ResourceDoesNotExist

        if not self.has_release_permission(
            request, organization, release, require_all_projects=True
        ):
            raise ResourceDoesNotExist

        return self.update_releasefile(request, release, file_id)

    @extend_schema(
        operation_id="Delete an Organization Release's File",
        description="Delete a file for a given release.",
        parameters=[GlobalParams.ORG_ID_OR_SLUG, ReleaseParams.VERSION, ReleaseParams.FILE_ID],
        responses={
            204: RESPONSE_NO_CONTENT,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
    )
    def delete(self, request: Request, organization, version, file_id) -> Response[None]:
        try:
            release = Release.objects.get(organization_id=organization.id, version=version)
        except Release.DoesNotExist:
            raise ResourceDoesNotExist

        if not self.has_release_permission(
            request, organization, release, require_all_projects=True
        ):
            raise ResourceDoesNotExist

        return self.delete_releasefile(release, file_id)
