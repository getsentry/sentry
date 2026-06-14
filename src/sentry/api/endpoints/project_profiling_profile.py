from typing import Any

import orjson
import vroomrs
from django.http import Http404, HttpResponse, StreamingHttpResponse
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint
from sentry.api.serializers import serialize
from sentry.apidocs.constants import RESPONSE_FORBIDDEN, RESPONSE_NOT_FOUND, RESPONSE_UNAUTHORIZED
from sentry.apidocs.examples.profiling_examples import ProfilingExamples
from sentry.apidocs.parameters import GlobalParams
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.models.files.utils import get_profiles_storage
from sentry.models.project import Project
from sentry.models.release import Release
from sentry.profiles.utils import get_from_profiling_service, proxy_profiling_service

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
        operation_id="Retrieve a Profile",
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
    def get(
        self,
        request: Request,
        project: Project,
        profiler_id: str,
        chunk_id: str,
        attachment_name: str,
    ) -> Response | StreamingHttpResponse:
        """Download an attachment (e.g. a perfetto trace) of a profile chunk.

        The chunk is loaded from the profiles object store and carries the list
        of its attachments, each with a name, content type and the object store
        id of the attached file. The client only supplies the profiler/chunk IDs
        and the attachment name; everything else is resolved server-side.
        """
        if not features.has(
            "organizations:continuous-profiling", project.organization, actor=request.user
        ):
            return Response(status=404)

        storage = get_profiles_storage()

        chunk_path = f"{project.organization_id}/{project.id}/{profiler_id}/{chunk_id}"
        if not storage.exists(chunk_path):
            raise Http404

        try:
            with storage.open(chunk_path) as f:
                chunk = vroomrs.decompress_profile_chunk(f.read())
        except OSError:
            raise Http404

        attachment = next(
            (a for a in chunk.get_attachments() if a.name == attachment_name),
            None,
        )
        if attachment is None or not attachment.stored_id:
            raise Http404

        try:
            fp = storage.open(attachment.stored_id)
        except OSError:
            raise Http404

        def stream_attachment():
            with fp:
                while chunk := fp.read(4096):
                    yield chunk

        response = StreamingHttpResponse(
            stream_attachment(),
            content_type=attachment.content_type or "application/octet-stream",
        )
        response["Content-Disposition"] = f'attachment; filename="{attachment.name}"'
        return response
