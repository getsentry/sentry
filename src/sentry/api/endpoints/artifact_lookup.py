import logging
from typing import List, Optional, Sequence, Set, Tuple

from django.http import Http404, HttpResponse, StreamingHttpResponse
from rest_framework.request import Request
from rest_framework.response import Response
from symbolic import SymbolicError, normalize_debug_id

from sentry import ratelimits
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint, ProjectReleasePermission
from sentry.api.endpoints.debug_files import has_download_permission
from sentry.api.serializers import serialize
from sentry.auth.system import is_system_auth
from sentry.lang.native.sources import get_internal_artifact_lookup_source_url
from sentry.models import DebugIdArtifactBundle, Distribution, File, Release, ReleaseFile
from sentry.models.artifactbundle import ReleaseArtifactBundle
from sentry.models.project import Project

logger = logging.getLogger("sentry.api")

# The marker for "release" bundles
RELEASE_BUNDLE_TYPE = "release.bundle"
# The number of bundles ("artifact" or "release") that we query
MAX_BUNDLES_QUERY = 2
# The number of files returned by the `get_releasefiles` query
MAX_RELEASEFILES_QUERY = 10


@region_silo_endpoint
class ProjectArtifactLookupEndpoint(ProjectEndpoint):
    permission_classes = (ProjectReleasePermission,)

    def download_file(self, file_id, project: Project):
        rate_limited = ratelimits.is_limited(
            project=project,
            key=f"rl:ArtifactLookupEndpoint:download:{file_id}:{project.id}",
            limit=10,
        )
        if rate_limited:
            logger.info(
                "notification.rate_limited",
                extra={"project_id": project.id, "file_id": file_id},
            )
            return HttpResponse({"Too many download requests"}, status=429)

        file = File.objects.filter(id=file_id).first()

        if file is None:
            raise Http404

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

        if request.GET.get("download") is not None:
            if has_download_permission(request, project):
                return self.download_file(request.GET.get("download"), project)
            else:
                return Response(status=403)

        debug_ids = []
        for debug_id in request.GET.getlist("debug_id"):
            try:
                debug_ids.append(normalize_debug_id(debug_id))
            except SymbolicError:
                pass

        urls = request.GET.getlist("url")
        release_name = request.GET.get("release")
        dist_name = request.GET.get("dist")

        url = next(iter(urls), None)
        debug_id = next(iter(debug_ids), None)
        # TODO: should we validate the list of `debug_ids`/`urls` we get?
        # by validation I mean making sure we only get a single item, and the `url` is always defined?

        bundle_file_ids = set()
        if debug_id:
            bundle_file_ids = get_artifact_bundle_containing_debug_id(debug_id, project)

        individual_files = set()
        if url and release_name and not bundle_file_ids:
            # Get both the newest X release artifact bundles,
            # and also query the legacy artifact bundles. One of those should have the
            # file we are looking for. We want to return more here, even bundles that
            # do *not* contain the file, rather than opening up each bundle. We want to
            # avoid opening up bundles at all cost.
            bundle_file_ids |= get_release_artifacts(project, release_name, dist_name)

            release, dist = try_resolve_release_dist(project, release_name, dist_name)
            if release:
                bundle_file_ids |= get_legacy_release_bundles(release, dist)
                individual_files = get_legacy_releasefile_by_file_url(release, dist, url)

        # Then: Construct our response
        url_constructor = UrlConstructor(request, project)

        found_artifacts = []
        for file_id in bundle_file_ids:
            found_artifacts.append(
                {
                    "id": str(file_id),
                    "type": "bundle",
                    "url": url_constructor.url_for_file_id(file_id),
                }
            )

        for release_file in individual_files:
            found_artifacts.append(
                {
                    "id": str(release_file.file.id),
                    "type": "file",
                    "url": url_constructor.url_for_file_id(release_file.file.id),
                    # The `name` is the url/abs_path of the file,
                    # as in: `"~/path/to/file.min.js"`.
                    "abs_path": release_file.name,
                    # These headers should ideally include the `Sourcemap` reference
                    "headers": release_file.file.headers,
                }
            )

        # NOTE: We do not paginate this response, as we have very tight limits
        # on all the individual queries.
        return Response(serialize(found_artifacts, request.user))


def get_artifact_bundle_containing_debug_id(debug_id: str, project: Project) -> Set[int]:
    # We want to have the newest `File` for each `debug_id`.
    return set(
        DebugIdArtifactBundle.objects.filter(
            organization_id=project.organization.id,
            debug_id=debug_id,
        )
        .select_related("artifact_bundle__file_id")
        .values_list("artifact_bundle__file_id", flat=True)
        .order_by("-date_added")[:1]
    )


def get_release_artifacts(
    project: Project,
    release_name: str,
    dist_name: Optional[str],
) -> Set[int]:
    return set(
        ReleaseArtifactBundle.objects.filter(
            organization_id=project.organization.id,
            release_name=release_name,
            # In case no dist is provided, we will fall back to "" which is the NULL equivalent for our tables.
            # See `_create_artifact_bundle` in `src/sentry/tasks/assemble.py` for the reference.
            dist_name=dist_name or "",
        )
        .select_related("artifact_bundle__file_id")
        .values_list("artifact_bundle__file_id", flat=True)
        .order_by("-date_added")[:MAX_BUNDLES_QUERY]
    )


def try_resolve_release_dist(
    project: Project, release_name: str, dist_name: Optional[str]
) -> Tuple[Optional[Release], Optional[Distribution]]:
    release = None
    dist = None
    # TODO: Is there a way to safely query this and return `None` if not existing?
    try:
        release = Release.objects.get(
            organization_id=project.organization_id,
            projects=project,
            version=release_name,
        )

        # We cannot query for dist without a release anyway
        if dist_name:
            dist = Distribution.objects.get(release=release, name=dist_name)
    except Exception as exc:
        logger.error("Failed to read", exc_info=exc)

    return release, dist


def get_legacy_release_bundles(release: Release, dist: Optional[Distribution]):
    return set(
        ReleaseFile.objects.select_related("file")
        .filter(
            release_id=release.id,
            dist_id=dist.id if dist else None,
            # a `ReleaseFile` with `0` artifacts represents a release archive,
            # see the comment above the definition of `artifact_count`.
            artifact_count=0,
            # similarly the special `type` is also used for release archives.
            file__type=RELEASE_BUNDLE_TYPE,
        )
        .values_list("file_id", flat=True)
        .order_by("-file__timestamp")[:MAX_BUNDLES_QUERY]
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

    def url_for_file_id(self, file_id: int) -> str:
        # NOTE: Returning a self-route that requires authentication (via Bearer token)
        # is not really forward compatible with a pre-signed URL that does not
        # require any authentication or headers whatsoever.
        # This also requires a workaround in Symbolicator, as its generic http
        # downloader blocks "internal" IPs, whereas the internal Sentry downloader
        # is explicitly exempt.
        return f"{self.base_url}?download={file_id}"
