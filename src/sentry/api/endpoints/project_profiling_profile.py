import posixpath
from collections.abc import Generator
from typing import Any

import orjson
from django.http import HttpResponse, StreamingHttpResponse
from drf_spectacular.utils import OpenApiParameter, extend_schema
from objectstore_client.errors import RequestError
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from sentry import features, roles
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint, ProjectPermission
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.serializers import serialize
from sentry.api.serializers.models.profilechunkattachment import (
    ProfileChunkAttachmentSerializer,
)
from sentry.apidocs.constants import RESPONSE_FORBIDDEN, RESPONSE_NOT_FOUND, RESPONSE_UNAUTHORIZED
from sentry.apidocs.examples.profiling_examples import ProfilingExamples
from sentry.apidocs.parameters import GlobalParams
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.auth.superuser import superuser_has_permission
from sentry.auth.system import is_system_auth
from sentry.constants import ATTACHMENTS_ROLE_DEFAULT
from sentry.models.organizationmember import OrganizationMember
from sentry.models.profilechunkattachment import ProfileChunkAttachment
from sentry.models.project import Project
from sentry.models.release import Release
from sentry.objectstore import get_profile_attachments_session, parse_accept_encoding
from sentry.profiles.utils import get_from_profiling_service, proxy_profiling_service


class ProfileChunkAttachmentPermission(ProjectPermission):
    """
    Profile-chunk attachments (e.g. Perfetto traces) can contain sensitive data,
    so downloading them requires the organization's configured attachments role,
    mirroring ``EventAttachmentDetailsPermission`` for event attachments.
    """

    def has_object_permission(self, request: Request, view: APIView, project: Project) -> bool:  # type: ignore[override]
        result = super().has_object_permission(request, view, project)
        if not result:
            return result

        if is_system_auth(request.auth) or superuser_has_permission(request):
            return True

        if not request.user.is_authenticated:
            return False

        organization = project.organization
        required_role = (
            organization.get_option("sentry:attachments_role") or ATTACHMENTS_ROLE_DEFAULT
        )

        try:
            om = OrganizationMember.objects.get(organization=organization, user_id=request.user.id)
        except OrganizationMember.DoesNotExist:
            return False

        return roles.get(om.role).priority >= roles.get(required_role).priority


PROFILE_ID_PATH_PARAM = OpenApiParameter(
    name="profile_id",
    location="path",
    required=True,
    type=str,
    description="The ID of the profile. Either a numeric ID or a 32-character hexadecimal string.",
)


class ProjectProfilingBaseEndpoint(ProjectEndpoint):
    owner = ApiOwner.PROFILING
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }


@extend_schema(tags=["Profiling"])
@cell_silo_endpoint
class ProjectProfilingProfileEndpoint(ProjectProfilingBaseEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.PUBLIC,
    }

    @extend_schema(
        operation_id="getProjectProfilingProfile",
        summary="Retrieve a Profile",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            GlobalParams.PROJECT_ID_OR_SLUG,
            PROFILE_ID_PATH_PARAM,
        ],
        responses={
            200: inline_sentry_response_serializer(
                "ProjectProfilingProfileResponse", dict[str, Any]
            ),
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
        examples=ProfilingExamples.PROFILE_DETAILS,
    )
    def get(
        self, request: Request, project: Project, profile_id: str
    ) -> Response[dict[str, Any]] | Response[None] | HttpResponse:
        """
        Retrieve a single profile by its ID.

        The response includes the profile's metadata, its sampled stack data, and the
        associated release, when one is found.

        Requires profiling to be enabled for the organization.
        """
        if not features.has("organizations:profiling", project.organization, actor=request.user):
            return Response(status=404)

        response = get_from_profiling_service(
            "GET",
            f"/organizations/{project.organization_id}/projects/{project.id}/profiles/{profile_id}",
            params={"format": "sample"},
        )

        if response.status == 200:
            profile: dict[str, Any] = orjson.loads(response.data)

            if "release" in profile:
                profile["release"] = get_release(project, profile["release"])
            else:
                # make sure to remove the version from the metadata
                # we're going to replace it with the release here
                version = profile.get("metadata", {}).pop("version")
                profile["metadata"]["release"] = get_release(project, version)

            return Response(profile)

        return HttpResponse(
            content=response.data,
            status=response.status,
            content_type=response.headers.get("Content-Type", "application/json"),
        )


def get_release(project: Project, version: str) -> Any:
    if not version:
        return None

    try:
        release = Release.objects.get(
            projects=project,
            organization_id=project.organization_id,
            version=version,
        )
        return serialize(release)
    except Release.DoesNotExist:
        return {"version": version}


@cell_silo_endpoint
class ProjectProfilingRawProfileEndpoint(ProjectProfilingBaseEndpoint):
    def get(self, request: Request, project: Project, profile_id: str) -> HttpResponse:
        if not features.has("organizations:profiling", project.organization, actor=request.user):
            return Response(status=404)
        kwargs: dict[str, Any] = {
            "method": "GET",
            "path": f"/organizations/{project.organization_id}/projects/{project.id}/raw_profiles/{profile_id}",
        }
        return proxy_profiling_service(**kwargs)


@cell_silo_endpoint
class ProjectProfilingRawChunkEndpoint(ProjectProfilingBaseEndpoint):
    def get(
        self, request: Request, project: Project, profiler_id: str, chunk_id: str
    ) -> HttpResponse:
        if not features.has(
            "organizations:continuous-profiling", project.organization, actor=request.user
        ):
            return Response(status=404)
        kwargs: dict[str, Any] = {
            "method": "GET",
            "path": f"/organizations/{project.organization_id}/projects/{project.id}/raw_chunks/{profiler_id}/{chunk_id}",
        }
        return proxy_profiling_service(**kwargs)


@cell_silo_endpoint
class ProjectProfilingChunkAttachmentEndpoint(ProjectProfilingBaseEndpoint):
    permission_classes = (ProfileChunkAttachmentPermission,)

    def get(
        self,
        request: Request,
        project: Project,
        profiler_id: str,
        chunk_id: str,
        attachment_id: str,
    ) -> Response | StreamingHttpResponse:
        if not features.has(
            "organizations:continuous-profiling-perfetto",
            project.organization,
            actor=request.user,
        ):
            return Response(status=404)

        try:
            attachment = ProfileChunkAttachment.objects.get(
                id=attachment_id,
                project_id=project.id,
                profiler_id=profiler_id,
                chunk_id=chunk_id,
            )
        except ProfileChunkAttachment.DoesNotExist:
            raise ResourceDoesNotExist

        if "download" not in request.GET:
            return Response(serialize(attachment, request.user, ProfileChunkAttachmentSerializer()))

        return self.download(attachment, project, request)

    def download(
        self, attachment: ProfileChunkAttachment, project: Project, request: Request
    ) -> StreamingHttpResponse:
        name = posixpath.basename(" ".join(attachment.name.split()))
        accept_encoding = parse_accept_encoding(request.headers.get("Accept-Encoding", ""))

        session = get_profile_attachments_session(project.organization_id, project.id)
        try:
            blob = session.get(attachment.stored_id, accept_encoding=accept_encoding or None)
        except RequestError as e:
            # The blob's Objectstore TTL and this row's cleanup are not perfectly
            # synchronized, so the blob may already be gone while the row lingers.
            if e.status == 404:
                raise ResourceDoesNotExist
            raise

        def stream_attachment() -> Generator[bytes]:
            with blob.payload as payload:
                while chunk := payload.read(4096):
                    yield chunk

        response = StreamingHttpResponse(
            stream_attachment(),
            content_type=attachment.content_type or "application/octet-stream",
        )
        if blob.metadata.compression:
            response["Content-Encoding"] = blob.metadata.compression
        response["Content-Disposition"] = f'attachment; filename="{name}"'
        return response
