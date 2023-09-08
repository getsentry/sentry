from typing import List, Union

from drf_spectacular.utils import extend_schema
from packaging.version import Version
from rest_framework.exceptions import NotFound
from rest_framework.request import Request
from rest_framework.response import Response
from typing_extensions import TypedDict

from sentry import eventstore, features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint
from sentry.apidocs.constants import RESPONSE_FORBIDDEN, RESPONSE_NOT_FOUND, RESPONSE_UNAUTHORIZED
from sentry.apidocs.parameters import EventParams, GlobalParams
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.models.artifactbundle import (
    ArtifactBundle,
    DebugIdArtifactBundle,
    ReleaseArtifactBundle,
)
from sentry.models.project import Project
from sentry.models.release import Release
from sentry.models.releasefile import ReleaseFile
from sentry.utils.safe import get_path

MIN_JS_SDK_VERSION_FOR_DEBUG_IDS = "7.56.0"

NO_DEBUG_ID_SDKS = {
    "sentry.javascript.capacitor",
    "sentry.javascript.cordova",
    "sentry.javascript.nextjs",
    "sentry.javascript.sveltekit",
}


class SourceMapProcessingIssueResponse(TypedDict):
    type: str
    message: str
    data: Union[dict, None]


class SourceMapProcessingResponse(TypedDict):
    errors: List[SourceMapProcessingIssueResponse]


@region_silo_endpoint
@extend_schema(tags=["Events"])
class SourceMapDebugEndpoint(ProjectEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }
    # TODO: Set owner to JS SDK team
    owner = ApiOwner.ISSUES

    @extend_schema(
        operation_id="Get Debug Information Related to Source Maps for a Given Event",
        parameters=[
            GlobalParams.ORG_SLUG,
            GlobalParams.PROJECT_SLUG,
            EventParams.EVENT_ID,
        ],
        request=None,
        responses={
            # TODO change serializer
            200: inline_sentry_response_serializer("SourceMapDebug", SourceMapProcessingResponse),
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
    )
    def get(self, request: Request, project: Project, event_id: str) -> Response:
        """
        Return a list of source map errors for a given event.
        """

        if not features.has("organizations:source-maps-debugger", project.organization, actor=request.user):
            raise NotFound(
                detail="Endpoint not available without 'organizations:source-maps-debugger' feature flag"
            )

        event = eventstore.backend.get_event_by_id(project.id, event_id)
        if event is None:
            raise NotFound(detail="Event not found")

        event_data = event.data
        exception_values = get_path(event_data, "exception", "values")

        project_has_some_artifact_bundle = ArtifactBundle.objects.filter(
            projectartifactbundle__project_id=project.id,
        ).exists()

        has_uploaded_release_bundle_with_release = False
        has_uploaded_artifact_bundle_with_release = False
        if event.release is not None:
            try:
                release = Release.objects.get(
                    organization=project.organization, version=event.release
                )
                has_uploaded_release_bundle_with_release = ReleaseFile.objects.filter(
                    release_id=release.id
                ).exists()
            except Release.DoesNotExist:
                pass
            has_uploaded_artifact_bundle_with_release = ReleaseArtifactBundle.objects.filter(
                organization_id=project.organization_id, release_name=event.release
            ).exists()

        has_uploaded_some_artifact_with_a_debug_id = DebugIdArtifactBundle.objects.filter(
            artifact_bundle__projectartifactbundle__project_id=project.id,
        ).exists()

        return Response(
            {
                "dist": event.dist,
                "release": event.release,
                "exceptions": [
                    get_data_from_exception_value(exception_value, event_data)
                    for exception_value in exception_values
                ]
                if exception_values is not None
                else [],
                "has_debug_ids": event_has_debug_ids(event_data),
                "sdk_version": get_path(event_data, "sdk", "version"),
                "project_has_some_artifact_bundle": project_has_some_artifact_bundle,
                "release_has_some_artifact": has_uploaded_release_bundle_with_release
                or has_uploaded_artifact_bundle_with_release,
                "has_uploaded_some_artifact_with_a_debug_id": has_uploaded_some_artifact_with_a_debug_id,
                "sdk_debug_id_support": get_sdk_debug_id_support(event_data),
            }
        )


def get_data_from_exception_value(exception, event_data):
    frames = get_path(exception, "raw_stacktrace", "frames")
    return {
        "frames": [get_data_from_stack_frame(frame, event_data) for frame in frames]
        if frames is not None
        else [],
    }


def get_data_from_stack_frame(frame, event_data):
    return {
        "debug_id_process": get_debug_id_process_data_for_stack_frame(frame, event_data),
        "release_process": get_release_process_data_for_stack_frame(frame),
        "scraping_process": get_scraping_process_data_for_stack_frame(frame),
    }


def get_debug_id_process_data_for_stack_frame(frame, event_data):
    abs_path = get_path(frame, "abs_path")
    debug_images = get_path(event_data, "debug_meta", "images")

    debug_id = None
    for debug_image in debug_images:
        if debug_image["type"] == "sourcemap" and abs_path == debug_image["code_file"]:
            debug_id = debug_image["debug_id"]
            break

    return {
        "debug_id": debug_id,
        "uploaded_source_file_with_correct_debug_id": "TODO",
        "uploaded_source_map_with_correct_debug_id": "TODO",
    }


def get_release_process_data_for_stack_frame(frame):
    return {
        "matching_artifact_name": "TODO",
        "source_map_reference": "TODO",
        "source_file_lookup_result": "TODO",
        "source_map_lookup_result": "TODO",
        "path": "TODO",
    }


def get_scraping_process_data_for_stack_frame(frame):
    return {
        "source_file_scraping_status": "TODO",
        "source_map_scraping_status": "TODO",
    }


def event_has_debug_ids(event_data):
    debug_images = get_path(event_data, "debug_meta", "images")
    if debug_images is None:
        return False
    else:
        for debug_image in debug_images:
            if debug_image["type"] == "sourcemap":
                return True
        return False


def get_sdk_debug_id_support(event_data):
    sdk_name = get_path(event_data, "sdk", "name")

    if sdk_name is None:
        return "unofficial-sdk"
    elif sdk_name in NO_DEBUG_ID_SDKS:
        return "not-supported"

    sdk_version = get_path(event_data, "sdk", "version")
    if sdk_version is None:
        return "unofficial-sdk"

    return Version(sdk_version) >= Version(MIN_JS_SDK_VERSION_FOR_DEBUG_IDS)


# ipdb.set_trace()
