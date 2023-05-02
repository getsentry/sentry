import logging
from typing import List, Optional, Sequence, Set, Tuple

from django.db.models import Q
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
from sentry.models.artifactbundle import ArtifactBundleArchive, ReleaseArtifactBundle
from sentry.models.project import Project
from sentry.models.releasefile import read_artifact_index

logger = logging.getLogger("sentry.api")


# The number of ArtifactBundles we open up and parse to look for files inside.
MAX_SCANNED_BUNDLES = 2


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
        :qparam string debug_id: if set, will query and return all the artifact
                                  bundles that match one of the given `debug_id`s.
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

        url = next(urls)
        debug_id = next(debug_ids)
        # TODO: should we validate the list of `debug_ids`/`urls` we get?

        bundle_file_ids = ()
        if debug_id:
            bundle_file_ids = get_artifact_bundle_containing_debug_id(debug_id, project)

        individual_files = ()
        if url and release_name and not bundle_file_ids:
            # Get both the newest X release artifact bundles,
            # and also query the legacy artifact bundles. One of those should have the
            # file we are looking for. We want to return more here, even bundles that
            # do *not* contain the file, rather than opening up each bundle. We want to
            # avoid opening up bundles at all cost.
            bundle_file_ids += get_release_artifacts(project, release_name, dist_name)

            individual_files = try_resolve_url(url, project, release_name, dist_name)

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
    # Hopefully that will end up being only a single `File` in the end containing all the `debug_id`s.
    return set(
        DebugIdArtifactBundle.objects.filter(
            organization_id=project.organization.id,
            debug_id=debug_id,
        )
        .select_related("artifact_bundle__file_id")
        .values_list("artifact_bundle__file_id")
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
        .values_list("artifact_bundle__file_id")
        .order_by("-date_added")[:MAX_SCANNED_BUNDLES]
    )


def try_resolve_url(
    url: str,
    project: Project,
    release_name: str,
    dist_name: Optional[str],
    bundle_file_ids: Set[int],
) -> Sequence[File]:
    # Next, we want to look up legacy artifact indices / bundles
    # for that, we have to resolve the `release_name`/`dist_name` to models
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

    # TODO: should we rather return an error from the API in case the release is not found?
    if release is None:
        return list()

    # TODO:
    # collect_legacy_artifact_bundles_containing_urls(url, release, dist, bundle_file_ids)

    # And last but not least, we want to look up legacy individual release files
    return get_releasefiles_matching_url(url, release)


# TODO:
# def collect_legacy_artifact_bundles_containing_urls(
#     url: str, release: Release, dist: Optional[Distribution], bundle_file_ids: Set[int]
# ) -> List[str]:
#     artifact_index = None
#     try:
#         artifact_index = read_artifact_index(release, dist, artifact_count__gt=0)
#     except Exception as exc:
#         logger.error("Failed to read artifact index", exc_info=exc)
#     if not artifact_index:
#         return url

#     artifact_archives = dict()

#     def url_in_any_artifact_index(url: str):
#         file = find_file_in_archive_index(artifact_index, url)
#         if file is not None:
#             ident = file["archive_ident"]
#             archive = artifact_archives.get(ident)

#             if archive is not None:
#                 bundle_file_ids.add(archive)
#             else:
#                 artifact_file_id = ReleaseFile.objects.filter(
#                     release_id=release.id, ident=ident
#                 ).values("file_id")[0]["file_id"]
#                 artifact_archives[ident] = artifact_file_id
#                 bundle_file_ids.add(artifact_file_id)
#             return True
#         return False

#     return [url for url in urls if not url_in_any_artifact_index(url)]


def get_releasefiles_matching_url(urls: List[str], release: Release) -> Sequence[ReleaseFile]:
    # Exclude files which are also present in archive:
    file_list = (
        ReleaseFile.public_objects.filter(release_id=release.id)
        .exclude(artifact_count=0)
        .select_related("file")
    )

    condition = Q(name__icontains=urls[0])
    for url in urls[1:]:
        condition |= Q(name__icontains=url)
    file_list = file_list.filter(condition)
    return file_list[:MAX_RELEASEFILES_QUERY]


def url_exists_in_manifest(manifest: dict, url: str) -> bool:
    """
    Looks through all the files in the `ArtifactBundle` manifest and see if the
    `url` matches any of the files.
    """
    try:
        # TODO: Should this be a partial match?
        files = manifest.get("files", dict())
        for file in files.values():
            if url in file.get("url", ""):
                return True
        return False
    except Exception:
        return False


def find_file_in_archive_index(archive_index: dict, url: str) -> Optional[File]:
    """
    Looks through all the files in the `ArtifactIndex` and see if the
    `url` matches any of the files.
    """
    try:
        files = archive_index.get("files", dict())
        for key in files.keys():
            if url in key:
                return files[key]
        return None
    except Exception:
        return None


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
