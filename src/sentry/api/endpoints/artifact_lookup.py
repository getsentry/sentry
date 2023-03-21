import logging
from typing import List, Optional

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
from sentry.models import DebugIdArtifactBundle, Distribution, File, Release, ReleaseFile
from sentry.models.artifactbundle import ArtifactBundleArchive, ReleaseArtifactBundle
from sentry.models.releasefile import read_artifact_index

logger = logging.getLogger("sentry.api")


# The number of bundles we want to return based on a `debug_id` query.
MAX_BUNDLES_BY_DEBUG_ID = 4


# The number of ArtifactBundles we open up and parse to look for files inside.
MAX_SCANNED_BUNDLES = 2


# The number of files returned by the `get_releasefiles` query
MAX_RELEASEFILES_QUERY = 10


@region_silo_endpoint
class ProjectArtifactLookupEndpoint(ProjectEndpoint):
    permission_classes = (ProjectReleasePermission,)

    def download_file(self, file_id, project):
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
            return response
        except OSError:
            raise Http404

    def get(self, request: Request, project) -> Response:
        """
        List a Project's Individual Artifacts or Bundles
        ````````````````````````````````````````

        Retrieve a list of individual artifacts or artifact bundles for a given project.

        :pparam string organization_slug: the slug of the organization to query.
        :pparam string project_slug: the slug of the project to query.
        :qparam string debug_id: If set, will query and return all the artifact
                                  bundles that match one of the given `debug_id`s.
        :qparam string url: If set, will query and return all the individual
                             artifacts, or artifact bundles that contain files
                             that match the `url`. This is using a substring-match.
        :qparam string release: Used in conjunction with `url`.
        :qparam string dist: Used in conjunction with `url`.

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
        release = None
        dist = None

        # TODO: Is there a way to safely query this and return `None` if not existing?
        try:
            release = Release.objects.get(
                organization_id=project.organization_id,
                projects=project,
                version=release_name,
            )

            # We cannot query for dist without a release anywy
            if dist_name:
                dist = Distribution.objects.get(release=release, name=dist_name)
        except Exception as exc:
            logger.error("Failed to read", exc_info=exc)

        # For debug_ids, we will query for the artifact_bundle/file_id directly
        bundle_file_ids = set(
            DebugIdArtifactBundle.objects.filter(
                organization_id=project.organization.id,
                debug_id__in=debug_ids,
            )
            .select_related("artifact_bundle")
            .values_list("artifact_bundle__file_id", flat=True)
            .distinct("artifact_bundle__file_id")[: MAX_BUNDLES_BY_DEBUG_ID + 1]
        )
        individual_files = set()

        if len(bundle_file_ids) > MAX_BUNDLES_BY_DEBUG_ID:
            logger.error(
                "querying for artifact bundles by `debug_id` yielded more than %s results",
                MAX_BUNDLES_BY_DEBUG_ID,
            )

        if len(urls) > 0:
            if release_name is None:
                logger.error("trying to look up artifacts by `url` without a `release`")
            else:
                # If we have `urls`, we want to:
                # First, get the newest X artifact bundles, and *look inside them*
                # to figure out if the file is included in any of them
                releases_with_bundles = ReleaseArtifactBundle.objects.filter(
                    organization_id=project.organization.id,
                    release_name=release_name,
                    dist_name=dist_name,
                ).select_related("artifact_bundle__file")[:MAX_SCANNED_BUNDLES]

                manifests = []
                for release in releases_with_bundles:
                    file_id = release.artifact_bundle.file.id
                    with release.artifact_bundle.file.getfile() as file:
                        archive = ArtifactBundleArchive(file)
                        manifest = archive._read_manifest()
                        manifests.append((file_id, manifest))

                artifact_index = None
                try:
                    artifact_index = read_artifact_index(release, dist, artifact_count__gt=0)
                except Exception as exc:
                    logger.error("Failed to read artifact index", exc_info=exc)

                artifact_archives = dict()

                def url_in_any_manifest(url):
                    for (file_id, manifest) in manifests:
                        if url_exists_in_manifest(manifest, url):
                            bundle_file_ids.add(file_id)
                            return True
                    return False

                def url_in_any_artifact_index(url):
                    if artifact_index is None:
                        return False

                    file = find_file_in_archive_index(artifact_index, url)
                    if file is not None:
                        ident = file["archive_ident"]
                        archive = artifact_archives.get(ident)

                        if archive is not None:
                            bundle_file_ids.add(archive)
                        else:
                            artifact_index_qs = ReleaseFile.objects.filter(
                                release_id=release.id, ident=ident
                            ).select_related("file")
                            artifact_archives[ident] = artifact_index_qs[0].file.id
                            bundle_file_ids.add(artifact_index_qs[0].file.id)
                        return True
                    return False

                missing_urls = []
                for url in urls:
                    if not url_in_any_manifest(url) and not url_in_any_artifact_index(url):
                        missing_urls.append(url)

                if len(missing_urls) > 0 and release is not None:
                    individual_files = get_releasefiles(missing_urls, release)

                # Possibly use the algorithm sketched up here:
                # https://github.com/getsentry/sentry/pull/45697#issuecomment-1466389132
                # That would narrow down our set of bundles to the minimum set that covers
                # the file names we are querying for, and also leave us with the remaining
                # set of file names that are not covered by any bundle, to look up below

        # Then: Construct our response
        url_constructor = UrlConstructor(request)

        found_artifacts = []
        for file_id in bundle_file_ids:
            found_artifacts.append(
                {
                    "type": "bundle",
                    "url": url_constructor.url_for_file_id(file_id),
                }
            )

        for file in individual_files:
            found_artifacts.append(
                {
                    "type": "file",
                    "url": url_constructor.url_for_file_id(file.id),
                    # The `name` is the url/abs_path of the file,
                    # as in: `"~/path/to/file.min.js"`.
                    "abs_path": file.name,
                    # These headers should ideally include the `Sourcemap` reference
                    "headers": file.headers,
                }
            )

        # NOTE: We do not paginate this response, as we have very tight limits
        # on all the individual queries.
        return Response(serialize(found_artifacts, request.user))


def get_releasefiles(urls: List[str], release: Release):
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
    file_list = file_list[:MAX_RELEASEFILES_QUERY]

    return set(map(lambda release_file: release_file.file, file_list))


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
    def __init__(self, request: Request):
        # TODO: is there a better way to construct a url to this same route?
        self.base_url = request.build_absolute_uri(request.path)

    def url_for_file_id(self, file_id: int) -> str:
        # NOTE: Returning a self-route that requires authentication (via Bearer token)
        # is not really forward compatible with a pre-signed URL that does not
        # require any authentication or headers whatsoever.
        # This also requires a workaround in Symbolicator, as its generic http
        # downloader blocks "internal" IPs, whereas the internal Sentry downloader
        # is explicitly exempt.
        return f"{self.base_url}?download={file_id}"
