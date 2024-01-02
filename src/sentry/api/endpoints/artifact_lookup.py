import logging
from typing import Dict, List, Optional, Sequence, Set, Tuple

from django.http import Http404, HttpResponse, StreamingHttpResponse
from rest_framework.request import Request
from rest_framework.response import Response
from symbolic.debuginfo import normalize_debug_id
from symbolic.exceptions import SymbolicError

from sentry import ratelimits
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint, ProjectReleasePermission
from sentry.api.endpoints.debug_files import has_download_permission
from sentry.api.serializers import serialize
from sentry.auth.system import is_system_auth
from sentry.debug_files.artifact_bundles import (
    MAX_BUNDLES_QUERY,
    query_artifact_bundles_containing_file,
)
from sentry.lang.native.sources import get_internal_artifact_lookup_source_url
from sentry.models.artifactbundle import NULL_STRING, ArtifactBundle, ArtifactBundleFlatFileIndex
from sentry.models.distribution import Distribution
from sentry.models.project import Project
from sentry.models.release import Release
from sentry.models.releasefile import ReleaseFile
from sentry.utils import metrics

logger = logging.getLogger("sentry.api")

# The marker for "release" bundles
RELEASE_BUNDLE_TYPE = "release.bundle"
# The number of files returned by the `get_releasefiles` query
MAX_RELEASEFILES_QUERY = 10


@region_silo_endpoint
class ProjectArtifactLookupEndpoint(ProjectEndpoint):
    owner = ApiOwner.WEB_FRONTEND_SDKS
    publish_status = {
        "GET": ApiPublishStatus.UNKNOWN,
    }
    permission_classes = (ProjectReleasePermission,)

    def download_file(self, download_id, project: Project):
        split = download_id.split("/")
        if len(split) < 2:
            raise Http404
        ty, ty_id, *_rest = split

        rate_limited = ratelimits.backend.is_limited(
            project=project,
            key=f"rl:ArtifactLookupEndpoint:download:{download_id}:{project.id}",
            limit=10,
        )
        if rate_limited:
            logger.info(
                "notification.rate_limited",
                extra={"project_id": project.id, "file_id": download_id},
            )
            return HttpResponse({"Too many download requests"}, status=429)

        file = None
        if ty == "artifact_bundle":
            file = (
                ArtifactBundle.objects.filter(
                    id=ty_id,
                    projectartifactbundle__project_id=project.id,
                )
                .select_related("file")
                .first()
            )
            metrics.incr("sourcemaps.download.artifact_bundle")
        elif ty == "release_file":
            # NOTE: `ReleaseFile` does have a `project_id`, but that seems to
            # be always empty, so using the `organization_id` instead.
            file = (
                ReleaseFile.objects.filter(id=ty_id, organization_id=project.organization.id)
                .select_related("file")
                .first()
            )
            metrics.incr("sourcemaps.download.release_file")
        elif ty == "bundle_index":
            file = ArtifactBundleFlatFileIndex.objects.filter(
                id=ty_id, project_id=project.id
            ).first()
            metrics.incr("sourcemaps.download.flat_file_index")

            if file is not None and (data := file.load_flat_file_index()):
                return HttpResponse(data, content_type="application/json")
            else:
                raise Http404

        if file is None:
            raise Http404
        file = file.file

        try:
            fp = file.getfile()
            response = StreamingHttpResponse(
                iter(lambda: fp.read(4096), b""), content_type="application/octet-stream"
            )
            response["Content-Length"] = file.size
            response["Content-Disposition"] = f'attachment; filename="{file.name}"'
            return response
        except OSError:
            raise Http404

    def get(self, request: Request, project: Project) -> Response:
        """
        List a Project's Individual Artifacts or Bundles
        ````````````````````````````````````````

        Retrieve a list of individual artifacts or artifact bundles for a given project.

        :pparam string organization_slug: the slug of the organization to query.
        :pparam string project_slug: the slug of the project to query.
        :qparam string debug_id: if set, will query and return the artifact
                                 bundle that matches the given `debug_id`.
        :qparam string url: if set, will query and return all the individual
                            artifacts, or artifact bundles that contain files
                            that match the `url`. This is using a substring-match.
        :qparam string release: used in conjunction with `url`.
        :qparam string dist: used in conjunction with `url`.

        :auth: required
        """
        if (download_id := request.GET.get("download")) is not None:
            if has_download_permission(request, project):
                return self.download_file(download_id, project)
            else:
                return Response(status=403)

        debug_id = request.GET.get("debug_id")
        try:
            debug_id = normalize_debug_id(debug_id)
        except SymbolicError:
            pass
        url = request.GET.get("url") or NULL_STRING
        release_name = request.GET.get("release") or NULL_STRING
        dist_name = request.GET.get("dist") or NULL_STRING

        # First query all the files:
        # We first do that using the `ArtifactBundle` infrastructure.
        artifact_bundles = query_artifact_bundles_containing_file(
            project, release_name, dist_name, url, debug_id
        )
        all_bundles: Dict[str, str] = {
            f"artifact_bundle/{bundle_id}": resolved for bundle_id, resolved in artifact_bundles
        }

        # If no `ArtifactBundle`s were found matching the file, we fall back to
        # looking up the file using the legacy `ReleaseFile` infrastructure.
        individual_files = []
        if not artifact_bundles:
            release, dist = try_resolve_release_dist(project, release_name, dist_name)
            if release:
                metrics.incr("sourcemaps.lookup.release_file")
                for releasefile_id in get_legacy_release_bundles(release, dist):
                    all_bundles[f"release_file/{releasefile_id}"] = "release-old"
                individual_files = get_legacy_releasefile_by_file_url(release, dist, url)

        # Then: Construct our response
        url_constructor = UrlConstructor(request, project)

        found_artifacts = []
        for download_id, resolved_with in all_bundles.items():
            found_artifacts.append(
                {
                    "id": download_id,
                    "type": "bundle",
                    "url": url_constructor.url_for_file_id(download_id),
                    "resolved_with": resolved_with,
                }
            )

        for release_file in individual_files:
            download_id = f"release_file/{release_file.id}"
            found_artifacts.append(
                {
                    "id": download_id,
                    "type": "file",
                    "url": url_constructor.url_for_file_id(download_id),
                    # The `name` is the url/abs_path of the file,
                    # as in: `"~/path/to/file.min.js"`.
                    "abs_path": release_file.name,
                    # These headers should ideally include the `Sourcemap` reference
                    "headers": release_file.file.headers,
                    "resolved_with": "release-old",
                }
            )

        # make sure we have a stable sort order for tests
        def natural_sort(key: str) -> Tuple[str, int]:
            split = key.split("/")
            if len(split) > 1:
                ty, ty_id = split
                return (ty, int(ty_id))
            else:
                return int(split[0])

        found_artifacts.sort(key=lambda x: natural_sort(x["id"]))

        # NOTE: We do not paginate this response, as we have very tight limits on all the individual queries.
        return Response(serialize(found_artifacts, request.user))


def try_resolve_release_dist(
    project: Project, release_name: str, dist_name: str
) -> Tuple[Optional[Release], Optional[Distribution]]:
    release = None
    dist = None
    try:
        release = Release.objects.get(
            organization_id=project.organization_id,
            projects=project,
            version=release_name,
        )

        # We cannot query for dist without a release anyway
        if dist_name:
            dist = Distribution.objects.get(release=release, name=dist_name)
    except (Release.DoesNotExist, Distribution.DoesNotExist):
        pass
    except Exception:
        logger.exception("Failed to read")

    return release, dist


def get_legacy_release_bundles(release: Release, dist: Optional[Distribution]) -> Set[int]:
    return set(
        ReleaseFile.objects.filter(
            release_id=release.id,
            dist_id=dist.id if dist else None,
            # a `ReleaseFile` with `0` artifacts represents a release archive,
            # see the comment above the definition of `artifact_count`.
            artifact_count=0,
            # similarly the special `type` is also used for release archives.
            file__type=RELEASE_BUNDLE_TYPE,
        ).values_list("id", flat=True)
        # TODO: this `order_by` might be incredibly slow
        # we want to have a hard limit on the returned bundles here. and we would
        # want to pick the most recently uploaded ones. that should mostly be
        # relevant for customers that upload multiple bundles, or are uploading
        # newer files for existing releases. In that case the symbolication is
        # already degraded, so meh...
        # .order_by("-file__timestamp")
        [:MAX_BUNDLES_QUERY]
    )


def get_legacy_releasefile_by_file_url(
    release: Release, dist: Optional[Distribution], url: List[str]
) -> Sequence[ReleaseFile]:
    # Exclude files which are also present in archive:
    return (
        ReleaseFile.public_objects.filter(
            release_id=release.id,
            dist_id=dist.id if dist else None,
        )
        .exclude(artifact_count=0)
        .select_related("file")
    ).filter(name__icontains=url)[:MAX_RELEASEFILES_QUERY]


class UrlConstructor:
    def __init__(self, request: Request, project: Project):
        if is_system_auth(request.auth):
            self.base_url = get_internal_artifact_lookup_source_url(project)
        else:
            self.base_url = request.build_absolute_uri(request.path)

    def url_for_file_id(self, download_id: str) -> str:
        # NOTE: Returning a self-route that requires authentication (via Bearer token)
        # is not really forward compatible with a pre-signed URL that does not
        # require any authentication or headers whatsoever.
        # This also requires a workaround in Symbolicator, as its generic http
        # downloader blocks "internal" IPs, whereas the internal Sentry downloader
        # is explicitly exempt.
        return f"{self.base_url}?download={download_id}"
