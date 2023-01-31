from typing import List, Union
from urllib.parse import urlparse

from drf_spectacular.utils import extend_schema
from rest_framework.exceptions import NotFound, ParseError
from rest_framework.request import Request
from rest_framework.response import Response
from typing_extensions import TypedDict

from sentry import eventstore, features
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint
from sentry.apidocs.constants import RESPONSE_FORBIDDEN, RESPONSE_NOTFOUND, RESPONSE_UNAUTHORIZED
from sentry.apidocs.parameters import EVENT_PARAMS, GLOBAL_PARAMS
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.lang.javascript.processor import discover_sourcemap, fetch_file
from sentry.models import (
    Distribution,
    Organization,
    Project,
    Release,
    ReleaseFile,
    SourceMapProcessingIssue,
)


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

    def has_feature(self, organization: Organization, request: Request):
        return features.has("organizations:fix-source-map-cta", organization, actor=request.user)

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

        if not self.has_feature(project.organization, request):
            raise NotFound(
                detail="Endpoint not available without 'organizations:fix-source-map-cta' feature flag"
            )

        frame_idx = request.GET.get("frame_idx")
        if not frame_idx:
            raise ParseError(detail="Query parameter 'frame_idx' is required")

        exception_idx = request.GET.get("exception_idx")
        if not exception_idx:
            raise ParseError(detail="Query parameter 'exception_idx' is required")

        event = eventstore.get_event_by_id(project.id, event_id)
        if event is None:
            raise NotFound(detail="Event not found")

        release_response = self._extract_release(event, project)
        if type(release_response) is Response:
            return release_response
        else:
            release = release_response

        user_agent = release.user_agent

        if not user_agent:
            return self._create_response(issue=SourceMapProcessingIssue.MISSING_USER_AGENT)

        num_artifacts = release.count_artifacts()

        if num_artifacts == 0:
            return self._create_response(issue=SourceMapProcessingIssue.MISSING_SOURCEMAPS)

        abs_path = self._get_abs_path(event, exception_idx, frame_idx)
        urlparts = urlparse(abs_path)

        if not (urlparts.scheme and urlparts.path):
            return self._create_response(
                issue=SourceMapProcessingIssue.URL_NOT_VALID, data={"absPath": abs_path}
            )

        release_artifacts = ReleaseFile.objects.filter(release_id=release.id)

        find_matching_artifact_response = self._find_matching_artifact(
            release_artifacts, urlparts, abs_path
        )

        if type(find_matching_artifact_response) is Response:
            return find_matching_artifact_response
        else:
            artifact = find_matching_artifact_response

        dist_response = self._verify_dist_matches(release, event, artifact)
        if type(dist_response) is Response:
            return dist_response
        else:
            dist = dist_response

        sourcemap_url = discover_sourcemap(fetch_file(artifact.name, project, release, dist))

        sourcemap_artifact_response = self._find_matching_artifact(
            release_artifacts, urlparse(sourcemap_url), sourcemap_url
        )
        if type(sourcemap_artifact_response) is Response:
            return sourcemap_artifact_response
        else:
            sourcemap_artifact = sourcemap_artifact_response

        sourcemap_dist_response = self._verify_dist_matches(release, event, sourcemap_artifact)
        if type(sourcemap_dist_response) is Response:
            return sourcemap_dist_response

        return self._create_response()

    def _create_response(self, issue=None, data=None):
        errors_list = []
        if issue:
            response = SourceMapProcessingIssue(issue, data=data).get_api_context()
            errors_list.append(response)
        return Response({"errors": errors_list})

    def _get_abs_path(self, event, exception_idx, frame_idx):
        exceptions = event.interfaces["exception"].values
        frame_list = exceptions[int(exception_idx)].stacktrace.frames
        frame = frame_list[int(frame_idx)]
        abs_path = frame.abs_path
        return abs_path

    def _find_mathches(self, release_artifacts, urlparts):
        full_matches = [
            artifact
            for artifact in release_artifacts
            if urlparse(artifact.name).path == urlparts.path
        ]
        partial_matches = [
            artifact
            for artifact in release_artifacts
            if artifact.name.endswith(urlparts.path.split("/")[-1])
        ]
        return full_matches, partial_matches

    def _extract_release(self, event, project):
        release_version = event.get_tag("sentry:release")

        if not release_version:
            return self._create_response(issue=SourceMapProcessingIssue.MISSING_RELEASE)
        try:
            release = Release.objects.get(
                organization=project.organization, version=release_version
            )
        except Release.DoesNotExist:
            return self._create_response(issue=SourceMapProcessingIssue.MISSING_RELEASE)

        return release

    def _verify_dist_matches(self, release, event, artifact, sourcemap=False):

        dist_issue = (
            SourceMapProcessingIssue.DIST_MISMATCH
            if not sourcemap
            else SourceMapProcessingIssue.SOURCEMAP_NOT_FOUND
        )

        try:
            dist = Distribution.objects.get(release=release, name=event.dist)
        except Distribution.DoesNotExist:
            return self._create_response(
                issue=SourceMapProcessingIssue.DIST_NOT_FOUND, data={"eventDist": event.dist}
            )

        if artifact.dist_id != dist.id:
            return self._create_response(
                issue=dist_issue,
                data={"eventDist": dist.id, "artifactDist": artifact.dist_id},
            )
        return dist

    def _find_matching_artifact(self, release_artifacts, urlparts, abs_path, sourcemap=False):
        full_matches, partial_matches = self._find_mathches(release_artifacts, urlparts)

        partial_issue = (
            SourceMapProcessingIssue.PARTIAL_MATCH
            if not sourcemap
            else SourceMapProcessingIssue.SOURCEMAP_NOT_FOUND
        )
        no_match_issue = (
            SourceMapProcessingIssue.NO_URL_MATCH
            if not sourcemap
            else SourceMapProcessingIssue.SOURCEMAP_NOT_FOUND
        )

        if len(full_matches) == 0:
            if len(partial_matches) > 0:
                return self._create_response(
                    issue=partial_issue,
                    data={"absPath": abs_path, "partialMatch": partial_matches[0].name},
                )
            return self._create_response(issue=no_match_issue, data={"absPath": abs_path})
        return full_matches[0]
