from typing import Literal, TypedDict

import sentry_sdk
from django.db.models import QuerySet
from django.utils.encoding import force_bytes, force_str
from drf_spectacular.utils import extend_schema
from packaging.version import Version
from rest_framework.exceptions import NotFound
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import eventstore
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint
from sentry.apidocs.constants import RESPONSE_FORBIDDEN, RESPONSE_NOT_FOUND, RESPONSE_UNAUTHORIZED
from sentry.apidocs.parameters import EventParams, GlobalParams
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.models.artifactbundle import (
    ArtifactBundle,
    ArtifactBundleArchive,
    DebugIdArtifactBundle,
    ReleaseArtifactBundle,
    SourceFileType,
)
from sentry.models.project import Project
from sentry.models.release import Release
from sentry.models.releasefile import (
    ARTIFACT_INDEX_FILENAME,
    ARTIFACT_INDEX_TYPE,
    ReleaseArchive,
    ReleaseFile,
)
from sentry.sdk_updates import get_sdk_index
from sentry.utils import json
from sentry.utils.javascript import find_sourcemap
from sentry.utils.safe import get_path
from sentry.utils.urls import non_standard_url_join

MIN_JS_SDK_VERSION_FOR_DEBUG_IDS = "7.56.0"
MIN_REACT_NATIVE_SDK_VERSION_FOR_DEBUG_IDS = "5.11.1"
MIN_ELECTRON_SDK_VERSION_FOR_DEBUG_IDS = "4.6.0"
MIN_NEXTJS_AND_SVELTEKIT_SDK_VERSION_FOR_DEBUG_IDS = "8.0.0"

NO_DEBUG_ID_SDKS = {
    "sentry.javascript.capacitor",
    "sentry.javascript.wasm",
    "sentry.javascript.cordova",
}

# This number will equate to an upper bound of file lookups/downloads
ARTIFACT_INDEX_LOOKUP_LIMIT = 25


class ScrapingResultSuccess(TypedDict):
    url: str
    status: Literal["success"]


class ScrapingResultNotAttempted(TypedDict):
    url: str
    status: Literal["not_attempted"]


class ScrapingResultFailure(TypedDict):
    url: str
    status: Literal["failure"]
    reason: Literal[
        "not_found",
        "disabled",
        "invalid_host",
        "permission_denied",
        "timeout",
        "download_error",
        "other",
    ]
    details: str | None


class SourceMapScrapingProcessResult(TypedDict):
    source_file: None | (ScrapingResultSuccess | ScrapingResultNotAttempted | ScrapingResultFailure)
    source_map: None | (ScrapingResultSuccess | ScrapingResultNotAttempted | ScrapingResultFailure)


class SourceMapDebugIdProcessResult(TypedDict):
    debug_id: str | None
    uploaded_source_file_with_correct_debug_id: bool
    uploaded_source_map_with_correct_debug_id: bool


class SourceMapReleaseProcessResult(TypedDict):
    abs_path: str
    matching_source_file_names: list[str]
    matching_source_map_name: str | None
    source_map_reference: str | None
    source_file_lookup_result: Literal["found", "wrong-dist", "unsuccessful"]
    source_map_lookup_result: Literal["found", "wrong-dist", "unsuccessful"]


class SourceMapDebugFrame(TypedDict):
    debug_id_process: SourceMapDebugIdProcessResult
    release_process: SourceMapReleaseProcessResult | None
    scraping_process: SourceMapScrapingProcessResult


class SourceMapDebugException(TypedDict):
    frames: list[SourceMapDebugFrame]


class SourceMapDebugResponse(TypedDict):
    dist: str | None
    release: str | None
    exceptions: list[SourceMapDebugException]
    has_debug_ids: bool
    min_debug_id_sdk_version: str | None
    sdk_version: str | None
    project_has_some_artifact_bundle: bool
    release_has_some_artifact: bool
    has_uploaded_some_artifact_with_a_debug_id: bool
    sdk_debug_id_support: Literal["not-supported", "unofficial-sdk", "needs-upgrade", "full"]
    has_scraping_data: bool


@region_silo_endpoint
@extend_schema(tags=["Events"])
class SourceMapDebugBlueThunderEditionEndpoint(ProjectEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }

    owner = ApiOwner.WEB_FRONTEND_SDKS

    @extend_schema(
        operation_id="Get Debug Information Related to Source Maps for a Given Event",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            GlobalParams.PROJECT_ID_OR_SLUG,
            EventParams.EVENT_ID,
        ],
        request=None,
        responses={
            200: inline_sentry_response_serializer("SourceMapDebug", SourceMapDebugResponse),
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
    )
    def get(self, request: Request, project: Project, event_id: str) -> Response:
        """
        Return a list of source map errors for a given event.
        """

        event = eventstore.backend.get_event_by_id(project.id, event_id)
        if event is None:
            raise NotFound(detail="Event not found")

        event_data = event.data

        release = None
        if event.release is not None:
            try:
                release = Release.objects.get(
                    organization=project.organization, version=event.release
                )
            except Release.DoesNotExist:
                pass

        # get general information about what has been uploaded
        project_has_some_artifact_bundle = ArtifactBundle.objects.filter(
            projectartifactbundle__project_id=project.id,
        ).exists()
        has_uploaded_release_bundle_with_release = False
        has_uploaded_artifact_bundle_with_release = False
        if release is not None:
            has_uploaded_release_bundle_with_release = ReleaseFile.objects.filter(
                release_id=release.id
            ).exists()
            has_uploaded_artifact_bundle_with_release = ReleaseArtifactBundle.objects.filter(
                organization_id=project.organization_id, release_name=release.version
            ).exists()
        has_uploaded_some_artifact_with_a_debug_id = DebugIdArtifactBundle.objects.filter(
            organization_id=project.organization_id,
            artifact_bundle__projectartifactbundle__project_id=project.id,
        ).exists()

        debug_images = get_path(event_data, "debug_meta", "images")
        debug_images = debug_images if debug_images is not None else []

        # get information about which debug ids on the event have uploaded artifacts
        debug_ids = [
            debug_image["debug_id"]
            for debug_image in debug_images
            if debug_image["type"] == "sourcemap"
        ][0:100]
        debug_id_artifact_bundles = DebugIdArtifactBundle.objects.filter(
            artifact_bundle__projectartifactbundle__project_id=project.id,
            debug_id__in=debug_ids,
        )
        debug_ids_with_uploaded_source_file = set()
        debug_ids_with_uploaded_source_map = set()
        for debug_id_artifact_bundle in debug_id_artifact_bundles:
            if (
                SourceFileType(debug_id_artifact_bundle.source_file_type) == SourceFileType.SOURCE
                or SourceFileType(debug_id_artifact_bundle.source_file_type)
                == SourceFileType.MINIFIED_SOURCE
            ):
                debug_ids_with_uploaded_source_file.add(str(debug_id_artifact_bundle.debug_id))
            elif (
                SourceFileType(debug_id_artifact_bundle.source_file_type)
                == SourceFileType.SOURCE_MAP
            ):
                debug_ids_with_uploaded_source_map.add(str(debug_id_artifact_bundle.debug_id))

        # Get all abs paths and query for their existence so that we can match release artifacts
        release_process_abs_path_data = {}
        if release is not None:
            abs_paths = get_abs_paths_in_event(event_data)
            for abs_path in abs_paths:
                path_data = ReleaseLookupData(abs_path, project, release, event).to_dict()
                release_process_abs_path_data[abs_path] = path_data

        # Get a map that maps from abs_path to scraping data
        scraping_attempt_map = get_scraping_attempt_map(event_data)

        # build information about individual exceptions and their stack traces
        processed_exceptions = []
        exception_values = get_path(event_data, "exception", "values")
        if exception_values is not None:
            for exception_value in exception_values:
                processed_frames = []
                frames = get_path(exception_value, "raw_stacktrace", "frames")
                stacktrace_frames = get_path(exception_value, "stacktrace", "frames")
                if frames is not None:
                    for frame_index, frame in enumerate(frames):
                        abs_path = get_path(frame, "abs_path")
                        debug_id = next(
                            (
                                debug_image["debug_id"]
                                for debug_image in debug_images
                                if debug_image["type"] == "sourcemap"
                                and abs_path == debug_image["code_file"]
                            ),
                            None,
                        )
                        processed_frames.append(
                            {
                                "debug_id_process": {
                                    "debug_id": debug_id,
                                    "uploaded_source_file_with_correct_debug_id": debug_id
                                    in debug_ids_with_uploaded_source_file,
                                    "uploaded_source_map_with_correct_debug_id": debug_id
                                    in debug_ids_with_uploaded_source_map,
                                },
                                "release_process": release_process_abs_path_data.get(abs_path),
                                "scraping_process": get_scraping_data_for_frame(
                                    scraping_attempt_map, frame, frame_index, stacktrace_frames
                                ),
                            }
                        )
                processed_exceptions.append({"frames": processed_frames})

        sdk_debug_id_support, min_debug_id_sdk_version = get_sdk_debug_id_support(event_data)

        return Response(
            {
                "dist": event.dist,
                "release": event.release,
                "exceptions": processed_exceptions,
                "has_debug_ids": event_has_debug_ids(event_data),
                "sdk_version": get_path(event_data, "sdk", "version"),
                "project_has_some_artifact_bundle": project_has_some_artifact_bundle,
                "release_has_some_artifact": has_uploaded_release_bundle_with_release
                or has_uploaded_artifact_bundle_with_release,
                "has_uploaded_some_artifact_with_a_debug_id": has_uploaded_some_artifact_with_a_debug_id,
                "sdk_debug_id_support": sdk_debug_id_support,
                "min_debug_id_sdk_version": min_debug_id_sdk_version,
                "has_scraping_data": event_data.get("scraping_attempts") is not None,
            }
        )


def get_scraping_data_for_frame(
    scraping_attempt_map, raw_frame, raw_frame_index, stacktrace_frames
):
    scraping_data = {"source_file": None, "source_map": None}

    abs_path = get_path(raw_frame, "abs_path")
    if abs_path is None:
        return scraping_data

    scraping_data["source_file"] = scraping_attempt_map.get(abs_path)

    frame = None
    if stacktrace_frames is not None:
        try:
            frame = stacktrace_frames[raw_frame_index]
        except IndexError:
            pass

    source_map_url = get_path(frame, "data", "sourcemap")
    if source_map_url is not None:
        scraping_data["source_map"] = scraping_attempt_map.get(source_map_url)

    return scraping_data


class ReleaseLookupData:
    def __init__(self, abs_path: str, project: Project, release: Release, event):
        self.abs_path = abs_path
        self.project = project
        self.release = release
        self.event = event

        self.matching_source_file_names = ReleaseFile.normalize(abs_path)

        # Source file lookup result variables
        self.source_file_lookup_result: Literal["found", "wrong-dist", "unsuccessful"] = (
            "unsuccessful"
        )
        self.found_source_file_name: None | (str) = (
            None  # The name of the source file artifact that was found, e.g. "~/static/bundle.min.js"
        )
        self.source_map_reference: None | (str) = (
            None  # The source map reference as found in the source file or its headers, e.g. "https://example.com/static/bundle.min.js.map"
        )
        self.matching_source_map_name: None | (str) = (
            None  # The location where Sentry will look for the source map (relative to the source file), e.g. "bundle.min.js.map"
        )

        # Cached db objects across operations
        self.artifact_index_release_files: QuerySet | list[ReleaseFile] | None = None
        self.dist_matched_artifact_index_release_file: ReleaseFile | None = None

        self._find_source_file_in_basic_uploaded_files()
        self._find_source_file_in_artifact_indexes()
        self._find_source_file_in_artifact_bundles()

        # Source map lookup result variable
        self.source_map_lookup_result: Literal["found", "wrong-dist", "unsuccessful"] = (
            "unsuccessful"
        )

        if self.source_map_reference is not None and self.found_source_file_name is not None:  # type: ignore[unreachable]
            if self.source_map_reference.startswith("data:"):  # type: ignore[unreachable]
                self.source_map_reference = "Inline Sourcemap"
                self.source_map_lookup_result = "found"
            else:
                matching_source_map_name = get_matching_source_map_location(
                    self.found_source_file_name, self.source_map_reference
                )
                self.matching_source_map_name = matching_source_map_name
                self._find_source_map_in_basic_uploaded_files(matching_source_map_name)
                self._find_source_map_in_artifact_indexes(matching_source_map_name)
                self._find_source_map_in_artifact_bundles(matching_source_map_name)

    def to_dict(self):
        return {
            "abs_path": self.abs_path,
            "matching_source_file_names": self.matching_source_file_names,
            "matching_source_map_name": self.matching_source_map_name,
            "source_map_reference": self.source_map_reference,
            "source_file_lookup_result": self.source_file_lookup_result,
            "source_map_lookup_result": self.source_map_lookup_result,
        }

    def _find_source_file_in_basic_uploaded_files(self):
        if self.source_file_lookup_result == "found":
            return

        basic_release_source_files = ReleaseFile.objects.filter(
            organization_id=self.project.organization_id,
            release_id=self.release.id,
            name__in=self.matching_source_file_names,
            artifact_count=1,  # Filter for un-zipped files
        ).select_related("file")

        if len(basic_release_source_files) > 0:
            self.source_file_lookup_result = "wrong-dist"

        for possible_release_file in basic_release_source_files:
            # Chck if dist matches
            if possible_release_file.ident == ReleaseFile.get_ident(
                possible_release_file.name, self.event.dist
            ):
                self.source_file_lookup_result = "found"
                self.found_source_file_name = possible_release_file.name
                sourcemap_header = None
                if possible_release_file.file.headers:
                    headers = ArtifactBundleArchive.normalize_headers(
                        possible_release_file.file.headers
                    )
                    sourcemap_header = headers.get("sourcemap", headers.get("x-sourcemap"))
                    sourcemap_header = (
                        force_bytes(sourcemap_header) if sourcemap_header is not None else None
                    )
                try:
                    source_map_reference = find_sourcemap(
                        sourcemap_header, possible_release_file.file.getfile().read()
                    )
                    self.source_map_reference = (
                        force_str(source_map_reference)
                        if source_map_reference is not None
                        else None
                    )
                except AssertionError:
                    pass
                return

    def _find_source_file_in_artifact_indexes(self):
        if self.source_file_lookup_result == "found":
            return

        dist_matched_artifact_index_release_file = (
            self._get_dist_matched_artifact_index_release_file()
        )
        if dist_matched_artifact_index_release_file is not None:
            raw_data = json.load(dist_matched_artifact_index_release_file.file.getfile())
            files = raw_data.get("files")
            for potential_source_file_name in self.matching_source_file_names:
                matching_file = files.get(potential_source_file_name)
                if matching_file is not None:
                    self.found_source_file_name = potential_source_file_name
                    self.source_file_lookup_result = "found"
                    archive_ident = matching_file.get("archive_ident")
                    if archive_ident is not None:
                        archive_file = ReleaseFile.objects.select_related("file").get(
                            organization_id=self.project.organization_id,
                            release_id=self.release.id,
                            file__type="release.bundle",
                            ident=archive_ident,
                        )
                        with ReleaseArchive(archive_file.file.getfile()) as archive:
                            source_file, headers = archive.get_file_by_url(
                                self.found_source_file_name
                            )
                            headers = ArtifactBundleArchive.normalize_headers(headers)
                            sourcemap_header = headers.get("sourcemap", headers.get("x-sourcemap"))
                            sourcemap_header = (
                                force_bytes(sourcemap_header)
                                if sourcemap_header is not None
                                else None
                            )
                            source_map_reference = find_sourcemap(
                                sourcemap_header, source_file.read()
                            )
                            self.source_map_reference = (
                                force_str(source_map_reference)
                                if source_map_reference is not None
                                else None
                            )
                    return

        for artifact_index_file in self._get_artifact_index_release_files():
            raw_data = json.load(artifact_index_file.file.getfile())
            files = raw_data.get("files")
            for potential_source_file_name in self.matching_source_file_names:
                if files.get(potential_source_file_name) is not None:
                    self.source_file_lookup_result = "wrong-dist"
                    return

    def _find_source_file_in_artifact_bundles(self):
        if self.source_file_lookup_result == "found":
            return

        possible_release_artifact_bundles = ReleaseArtifactBundle.objects.filter(
            organization_id=self.project.organization.id,
            release_name=self.release.version,
            artifact_bundle__projectartifactbundle__project_id=self.project.id,
            artifact_bundle__artifactbundleindex__organization_id=self.project.organization.id,
            artifact_bundle__artifactbundleindex__url__in=self.matching_source_file_names,
        )
        if len(possible_release_artifact_bundles) > 0:
            self.source_file_lookup_result = "wrong-dist"
        for possible_release_artifact_bundle in possible_release_artifact_bundles:
            if possible_release_artifact_bundle.dist_name == (self.event.dist or ""):
                with ArtifactBundleArchive(
                    possible_release_artifact_bundle.artifact_bundle.file.getfile()
                ) as archive:
                    archive_urls = archive.get_all_urls()
                    for potential_source_file_name in self.matching_source_file_names:
                        if potential_source_file_name in archive_urls:
                            matching_file, headers = archive.get_file_by_url(
                                potential_source_file_name
                            )
                            headers = ArtifactBundleArchive.normalize_headers(headers)
                            self.source_file_lookup_result = "found"
                            self.found_source_file_name = potential_source_file_name
                            sourcemap_header = headers.get("sourcemap", headers.get("x-sourcemap"))
                            sourcemap_header = (
                                force_bytes(sourcemap_header)
                                if sourcemap_header is not None
                                else None
                            )
                            try:
                                source_map_reference = find_sourcemap(
                                    sourcemap_header, matching_file.read()
                                )
                                self.source_map_reference = (
                                    force_str(source_map_reference)
                                    if source_map_reference is not None
                                    else None
                                )
                            except Exception:
                                pass
                            return

    def _find_source_map_in_basic_uploaded_files(self, matching_source_map_name: str):
        if self.source_map_lookup_result == "found":
            return

        basic_release_source_map_files = ReleaseFile.objects.filter(
            organization_id=self.project.organization_id,
            release_id=self.release.id,
            name=matching_source_map_name,
            artifact_count=1,  # Filter for un-zipped files
        ).select_related("file")

        if len(basic_release_source_map_files) > 0:
            self.source_map_lookup_result = "wrong-dist"
        for basic_release_source_map_file in basic_release_source_map_files:
            if basic_release_source_map_file.ident == ReleaseFile.get_ident(
                basic_release_source_map_file.name, self.event.dist
            ):
                self.source_map_lookup_result = "found"
                return

    def _find_source_map_in_artifact_indexes(self, matching_source_map_name: str):
        if self.source_map_lookup_result == "found":
            return

        dist_matched_artifact_index_release_file = (
            self._get_dist_matched_artifact_index_release_file()
        )
        if dist_matched_artifact_index_release_file is not None:
            raw_data = json.load(dist_matched_artifact_index_release_file.file.getfile())
            files = raw_data.get("files")
            if files.get(matching_source_map_name) is not None:
                self.source_map_lookup_result = "found"
                return

        for artifact_index_file in self._get_artifact_index_release_files():
            raw_data = json.load(artifact_index_file.file.getfile())
            files = raw_data.get("files")
            if files.get(matching_source_map_name) is not None:
                self.source_map_lookup_result = "wrong-dist"
                return

    def _find_source_map_in_artifact_bundles(self, matching_source_map_name: str):
        if self.source_map_lookup_result == "found":
            return

        possible_release_artifact_bundles = ReleaseArtifactBundle.objects.filter(
            organization_id=self.project.organization.id,
            release_name=self.release.version,
            artifact_bundle__projectartifactbundle__project_id=self.project.id,
            artifact_bundle__artifactbundleindex__organization_id=self.project.organization.id,
            artifact_bundle__artifactbundleindex__url=matching_source_map_name,
        )
        if len(possible_release_artifact_bundles) > 0:
            self.source_map_lookup_result = "wrong-dist"
        for possible_release_artifact_bundle in possible_release_artifact_bundles:
            if possible_release_artifact_bundle.dist_name == (self.event.dist or ""):
                self.source_map_lookup_result = "found"
                return

    def _get_artifact_index_release_files(self):
        # Cache result
        if self.artifact_index_release_files is not None:
            return self.artifact_index_release_files

        self.artifact_index_release_files = ReleaseFile.objects.filter(
            organization_id=self.project.organization_id,
            release_id=self.release.id,
            file__type="release.artifact-index",
        ).select_related("file")[
            :ARTIFACT_INDEX_LOOKUP_LIMIT
        ]  # limit by something sane in case people have a large number of dists for the same release

        return self.artifact_index_release_files

    def _get_dist_matched_artifact_index_release_file(self):
        # Cache result
        if self.dist_matched_artifact_index_release_file is not None:
            return self.dist_matched_artifact_index_release_file

        self.dist_matched_artifact_index_release_file = (
            ReleaseFile.objects.filter(
                organization_id=self.project.organization_id,
                release_id=self.release.id,
                ident=ReleaseFile.get_ident(ARTIFACT_INDEX_FILENAME, self.event.dist),
                file__type=ARTIFACT_INDEX_TYPE,
            )
            .select_related("file")
            .first()
        )

        return self.dist_matched_artifact_index_release_file


def get_matching_source_map_location(source_file_path, source_map_reference):
    return non_standard_url_join(force_str(source_file_path), force_str(source_map_reference))


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

    official_sdks = None
    try:
        sdk_release_registry = get_sdk_index()
        official_sdks = [
            sdk for sdk in sdk_release_registry.keys() if sdk.startswith("sentry.javascript.")
        ]
    except Exception as e:
        sentry_sdk.capture_exception(e)

    if official_sdks is None or len(official_sdks) == 0:
        # Fallback list if release registry is not available
        official_sdks = [
            "sentry.javascript.angular",
            "sentry.javascript.angular-ivy",
            "sentry.javascript.astro",
            "sentry.javascript.browser",
            "sentry.javascript.capacitor",
            "sentry.javascript.cordova",
            "sentry.javascript.cloudflare",
            "sentry.javascript.electron",
            "sentry.javascript.gatsby",
            "sentry.javascript.nextjs",
            "sentry.javascript.node",
            "sentry.javascript.opentelemetry-node",
            "sentry.javascript.react",
            "sentry.javascript.react-native",
            "sentry.javascript.remix",
            "sentry.javascript.solid",
            "sentry.javascript.svelte",
            "sentry.javascript.sveltekit",
            "sentry.javascript.vue",
        ]

    if sdk_name not in official_sdks or sdk_name is None:
        return "unofficial-sdk", None

    if sdk_name in NO_DEBUG_ID_SDKS:
        return "not-supported", None

    sdk_version = get_path(event_data, "sdk", "version")
    if sdk_version is None:
        return "unofficial-sdk", None

    if sdk_name == "sentry.javascript.react-native":
        return (
            (
                "full"
                if Version(sdk_version) >= Version(MIN_REACT_NATIVE_SDK_VERSION_FOR_DEBUG_IDS)
                else "needs-upgrade"
            ),
            MIN_REACT_NATIVE_SDK_VERSION_FOR_DEBUG_IDS,
        )

    if sdk_name == "sentry.javascript.electron":
        return (
            (
                "full"
                if Version(sdk_version) >= Version(MIN_ELECTRON_SDK_VERSION_FOR_DEBUG_IDS)
                else "needs-upgrade"
            ),
            MIN_ELECTRON_SDK_VERSION_FOR_DEBUG_IDS,
        )

    if sdk_name == "sentry.javascript.nextjs" or sdk_name == "sentry.javascript.sveltekit":
        return (
            (
                "full"
                if Version(sdk_version)
                >= Version(MIN_NEXTJS_AND_SVELTEKIT_SDK_VERSION_FOR_DEBUG_IDS)
                else "needs-upgrade"
            ),
            MIN_NEXTJS_AND_SVELTEKIT_SDK_VERSION_FOR_DEBUG_IDS,
        )

    return (
        (
            "full"
            if Version(sdk_version) >= Version(MIN_JS_SDK_VERSION_FOR_DEBUG_IDS)
            else "needs-upgrade"
        ),
        MIN_JS_SDK_VERSION_FOR_DEBUG_IDS,
    )


def get_abs_paths_in_event(event_data):
    abs_paths = set()
    exception_values = get_path(event_data, "exception", "values")
    if exception_values is not None:
        for exception_value in exception_values:
            frames = get_path(exception_value, "raw_stacktrace", "frames")
            if frames is not None:
                for frame in frames:
                    abs_path = get_path(frame, "abs_path")
                    if abs_path:
                        abs_paths.add(abs_path)
    return abs_paths


def get_scraping_attempt_map(event_data):
    scraping_attempt_map = {}  # maps from url to attempt
    scraping_attempts = event_data.get("scraping_attempts") or []
    for scraping_attempt in scraping_attempts:
        attempt_data = {"status": scraping_attempt["status"], "url": scraping_attempt["url"]}

        reason = scraping_attempt.get("reason")
        if reason is not None:
            attempt_data["reason"] = reason

        details = scraping_attempt.get("details")
        if details is not None:
            attempt_data["details"] = details

        scraping_attempt_map[scraping_attempt["url"]] = attempt_data
    return scraping_attempt_map
