from typing import List, Union
from urllib.parse import urlparse

from django.utils.encoding import force_bytes, force_text
from drf_spectacular.utils import extend_schema
from rest_framework.exceptions import NotFound, ParseError
from rest_framework.request import Request
from rest_framework.response import Response
from typing_extensions import TypedDict

from sentry import eventstore
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint
from sentry.api.endpoints.project_release_files import ArtifactSource
from sentry.apidocs.constants import RESPONSE_FORBIDDEN, RESPONSE_NOTFOUND, RESPONSE_UNAUTHORIZED
from sentry.apidocs.parameters import EVENT_PARAMS, GLOBAL_PARAMS
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.models import Distribution, Project, Release, ReleaseFile, SourceMapProcessingIssue
from sentry.models.releasefile import read_artifact_index
from sentry.utils.javascript import find_sourcemap
from sentry.utils.urls import non_standard_url_join


class SourceMapProcessingIssueResponse(TypedDict):
    type: str
    message: str
    data: Union[dict, None]


class SourceMapProcessingResponse(TypedDict):
    errors: List[SourceMapProcessingIssueResponse]


@region_silo_endpoint
@extend_schema(tags=["Events"])
class SourceMapDebugEndpoint(ProjectEndpoint):
    public = {"GET"}

    @extend_schema(
        operation_id="Debug issues related to source maps for a given event",
        parameters=[
            GLOBAL_PARAMS.ORG_SLUG,
            GLOBAL_PARAMS.PROJECT_SLUG,
            EVENT_PARAMS.EVENT_ID,
            EVENT_PARAMS.FRAME_IDX,
            EVENT_PARAMS.EXCEPTION_IDX,
        ],
        request=None,
        responses={
            200: inline_sentry_response_serializer("SourceMapDebug", SourceMapProcessingResponse),
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOTFOUND,
        },
    )
    def get(self, request: Request, project: Project, event_id: str) -> Response:
        """
        Retrieve information about source maps for a given event.
        ```````````````````````````````````````````
        Return a list of source map errors for a given event.
        """
        frame_idx = request.GET.get("frame_idx")
        if not frame_idx:
            raise ParseError(detail="Query parameter 'frame_idx' is required")

        frame_idx = int(frame_idx)

        exception_idx = request.GET.get("exception_idx")
        if not exception_idx:
            raise ParseError(detail="Query parameter 'exception_idx' is required")

        exception_idx = int(exception_idx)

        event = eventstore.get_event_by_id(project.id, event_id)
        if event is None:
            raise NotFound(detail="Event not found")

        try:
            if "exception" not in event.interfaces:
                raise ParseError(detail="Event does not contain an exception")
            exception = event.interfaces["exception"].values[exception_idx]
        except IndexError:
            raise ParseError(detail="Query parameter 'exception_idx' is out of bounds")
        frame, filename, abs_path = self._get_frame_filename_and_path(exception, frame_idx)
        if frame.data and "sourcemap" in frame.data:
            # already mapped
            return self._create_response()

        try:
            release = self._extract_release(event, project)
        except (SourceMapException, Release.DoesNotExist):
            return self._create_response(issue=SourceMapProcessingIssue.MISSING_RELEASE)

        user_agent = release.user_agent

        if not user_agent:
            return self._create_response(
                issue=SourceMapProcessingIssue.MISSING_USER_AGENT,
                data={"version": release.version, "filename": filename},
            )

        num_artifacts = release.count_artifacts()

        if num_artifacts == 0:
            return self._create_response(issue=SourceMapProcessingIssue.MISSING_SOURCEMAPS)

        urlparts = urlparse(abs_path)

        if not (urlparts.scheme and urlparts.path):
            return self._create_response(
                issue=SourceMapProcessingIssue.URL_NOT_VALID, data={"absPath": abs_path}
            )

        release_artifacts = self._get_releasefiles(release, project.organization.id)

        try:
            artifact = self._find_matching_artifact(
                release_artifacts, urlparts, abs_path, filename, release, event
            )
            sourcemap_url = self._discover_sourcemap_url(artifact, filename)
        except SourceMapException as e:
            return self._create_response(issue=e.issue, data=e.data)

        if not sourcemap_url:
            return self._create_response(
                issue=SourceMapProcessingIssue.SOURCEMAP_NOT_FOUND,
                data={
                    "filename": filename,
                },
            )

        sourcemap_url = non_standard_url_join(abs_path, sourcemap_url)

        try:
            sourcemap_artifact = self._find_matching_artifact(
                release_artifacts, urlparse(sourcemap_url), sourcemap_url, filename, release, event
            )

        except SourceMapException as e:
            return self._create_response(issue=e.issue, data=e.data)

        if not sourcemap_artifact.file.getfile().read():
            return self._create_response(
                issue=SourceMapProcessingIssue.SOURCEMAP_NOT_FOUND,
                data={"filename": filename},
            )

        return self._create_response()

    def _create_response(self, issue=None, data=None):
        errors_list = []
        if issue:
            response = SourceMapProcessingIssue(issue, data=data).get_api_context()
            errors_list.append(response)
        return Response({"errors": errors_list})

    def _get_frame_filename_and_path(self, exception, frame_idx):
        frame_list = exception.stacktrace.frames
        try:
            frame = frame_list[frame_idx]
        except IndexError:
            raise ParseError(detail="Query parameter 'frame_idx' is out of bounds")
        filename = frame.filename
        abs_path = frame.abs_path
        return frame, filename, abs_path

    def _find_matches(self, release_artifacts, unified_path, filename, release, event):
        full_matches = [
            artifact
            for artifact in release_artifacts
            if artifact.name == unified_path
            and self._verify_dist_matches(release, event, artifact, filename)
        ]
        partial_matches = self._find_partial_matches(unified_path, release_artifacts)
        return full_matches, partial_matches

    def _find_partial_matches(self, unified_path, artifacts):
        filename = unified_path.split("/")[-1]
        filename_matches = [artifact for artifact in artifacts if artifact.name.endswith(filename)]
        artifact_names = [artifact.name.split("/") for artifact in filename_matches]
        while any(artifact_names):
            for i in range(len(artifact_names)):
                if unified_path.endswith("/".join(artifact_names[i])):
                    return [artifacts[i]]
                artifact_names[i] = artifact_names[i][1:]
        return []

    def _extract_release(self, event, project):
        release_version = event.get_tag("sentry:release")

        if not release_version:
            raise SourceMapException(SourceMapProcessingIssue.MISSING_RELEASE)
        return Release.objects.get(organization=project.organization, version=release_version)

    def _verify_dist_matches(self, release, event, artifact, filename):
        try:
            if event.dist is None and artifact.dist_id is None:
                return
            dist = Distribution.objects.get(release=release, name=event.dist)
        except Distribution.DoesNotExist:
            raise SourceMapException(
                SourceMapProcessingIssue.DIST_MISMATCH,
                {"eventDist": event.dist, "filename": filename},
            )
        if artifact.dist_id != dist.id:
            raise SourceMapException(
                SourceMapProcessingIssue.DIST_MISMATCH,
                {"eventDist": dist.id, "artifactDist": artifact.dist_id, "filename": filename},
            )
        return True

    def _find_matching_artifact(
        self, release_artifacts, urlparts, abs_path, filename, release, event
    ):
        unified_path = self._unify_url(urlparts)
        full_matches, partial_matches = self._find_matches(
            release_artifacts, unified_path, filename, release, event
        )

        artifact_names = [artifact.name for artifact in release_artifacts]

        if len(full_matches) == 0:
            if len(partial_matches) > 0:
                partial_match = partial_matches[0]
                url_prefix = self._find_url_prefix(filename, partial_match.name)

                raise SourceMapException(
                    SourceMapProcessingIssue.PARTIAL_MATCH,
                    {
                        "absPath": abs_path,
                        "partialMatchPath": partial_match.name,
                        "filename": filename,
                        "unifiedPath": unified_path,
                        "urlPrefix": url_prefix,
                        "artifactNames": artifact_names,
                    },
                )

            raise SourceMapException(
                SourceMapProcessingIssue.NO_URL_MATCH,
                {
                    "absPath": abs_path,
                    "filename": filename,
                    "unifiedPath": unified_path,
                    "artifactNames": artifact_names,
                },
            )
        return full_matches[0]

    def _discover_sourcemap_url(self, artifact, filename):
        file = artifact.file
        # Code adapted from sentry/lang/javascript/processor.py
        sourcemap_header = file.headers.get("Sourcemap", file.headers.get("X-SourceMap"))
        sourcemap_header = force_bytes(sourcemap_header) if sourcemap_header is not None else None
        try:
            sourcemap = find_sourcemap(sourcemap_header, file.getfile().read())
        except AssertionError:
            raise SourceMapException(
                SourceMapProcessingIssue.SOURCEMAP_NOT_FOUND, {"filename": filename}
            )

        return force_text(sourcemap) if sourcemap is not None else None

    def _unify_url(self, urlparts):
        return "~" + urlparts.path

    def _get_releasefiles(self, release, organization_id):
        data_sources = []

        file_list = ReleaseFile.public_objects.filter(release_id=release.id).exclude(
            artifact_count=0
        )
        file_list = file_list.select_related("file").order_by("name")

        data_sources.extend(list(file_list.order_by("name")))

        dists = Distribution.objects.filter(organization_id=organization_id, release=release)
        for dist in list(dists) + [None]:
            try:
                artifact_index = read_artifact_index(release, dist, artifact_count__gt=0)
            except Exception:
                artifact_index = None

            if artifact_index is not None:
                files = artifact_index.get("files", {})
                source = ArtifactSource(dist, files, [], [])
                data_sources.extend(source[:])

        return data_sources

    def _find_url_prefix(self, filepath, artifact_name):
        # Right now, we only support 3 cases for finding the url prefix:
        # 1. If the file name is a suffix of the artifact name, return the missing prefix
        # Example : "/static/app.js" and "~/dist/static/app/js"
        # 2. If there is only 1 substitution needed to make the file name and artifact name match
        # Example : "~/dist/static/header/app.js" and "~/dist/static/footer/app.js"
        # 3. If there is only 1 difference that needs to be added to make the file name and artifact name match
        # Example : "~/dist/app.js" and "~/dist/static/header/app.js"
        idx = artifact_name.find(filepath)
        # If file name is suffix of artifact name, return the missing prefix
        if idx != -1:
            return artifact_name[:idx]

        filepath = filepath.split("/")
        artifact_name = artifact_name.split("/")
        if len(filepath) == len(artifact_name):
            matches = [filepath[i] != artifact_name[i] for i in range(len(filepath))]
            if sum(matches) == 1:
                idx = matches.index(True)
                return artifact_name[idx] + "/" if idx != -1 else None

        if len(filepath) + 1 == len(artifact_name):
            # If not suffix, find the missing parts and return them
            filepath = set(filepath)
            artifact_name = set(artifact_name)

            differences = list(filepath.symmetric_difference(artifact_name))
            if len(differences) == 1:
                return "/".join(differences + [""])


class SourceMapException(Exception):
    def __init__(self, issue, data=None):
        super().__init__(issue, data)
        self.issue = issue
        self.data = data
