from django.http.response import FileResponse
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
    RESPONSE_FORBIDDEN,
    RESPONSE_NO_CONTENT,
    RESPONSE_NOT_FOUND,
    RESPONSE_UNAUTHORIZED,
)
from sentry.apidocs.parameters import GlobalParams, ReleaseParams
from sentry.apidocs.response_types import ValidationErrorResponse
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.models.organization import Organization
from sentry.models.release import Release
from sentry.releases.endpoints.project_release_file_details import (
    ReleaseFileDetailsMixin,
    ReleaseFileSerializer,
)


@extend_schema(tags=["Releases"])
@cell_silo_endpoint
class OrganizationReleaseFileDetailsEndpoint(
    OrganizationReleasesBaseEndpoint, ReleaseFileDetailsMixin
):
    owner = ApiOwner.TELEMETRY_EXPERIENCE
    publish_status = {
        "DELETE": ApiPublishStatus.PRIVATE,
        "GET": ApiPublishStatus.PRIVATE,
        "PUT": ApiPublishStatus.PRIVATE,
    }

    @extend_schema(
        operation_id="Retrieve an Organization Release's File",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            ReleaseParams.VERSION,
            ReleaseParams.FILE_ID,
            OpenApiParameter(
                name="download",
                location="query",
                required=False,
                type=str,
                description="If set, download the file contents instead of returning metadata.",
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
    )
    def get(
        self, request: Request, organization, version, file_id
    ) -> Response[ReleaseFileSerializerResponse] | FileResponse | Response[None]:
        """
        Return metadata for an individual file within a release. Does not return the file
        contents unless `download` is set.
        """
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
        operation_id="Update an Organization Release's File",
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
    )
    def put(
        self, request: Request, organization: Organization, version, file_id
    ) -> Response[ReleaseFileSerializerResponse] | Response[ValidationErrorResponse]:
        """
        Update metadata of an existing release file. Currently only the name of the file
        can be changed.
        """
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
        parameters=[GlobalParams.ORG_ID_OR_SLUG, ReleaseParams.VERSION, ReleaseParams.FILE_ID],
        responses={
            204: RESPONSE_NO_CONTENT,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
    )
    def delete(self, request: Request, organization, version, file_id) -> Response:
        """
        Permanently remove a file from a release. Also removes the physical file from
        storage.
        """
        try:
            release = Release.objects.get(organization_id=organization.id, version=version)
        except Release.DoesNotExist:
            raise ResourceDoesNotExist

        if not self.has_release_permission(
            request, organization, release, require_all_projects=True
        ):
            raise ResourceDoesNotExist

        return self.delete_releasefile(release, file_id)
