import logging
from datetime import datetime, timedelta
from typing import List, Mapping, Optional, Sequence, Set, Tuple

import pytz
from django.db import transaction
from django.http import Http404, HttpResponse, StreamingHttpResponse
from rest_framework.request import Request
from rest_framework.response import Response
from symbolic import SymbolicError, normalize_debug_id

from sentry import options, ratelimits
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint, ProjectReleasePermission
from sentry.api.endpoints.debug_files import has_download_permission
from sentry.api.serializers import serialize
from sentry.auth.system import is_system_auth
from sentry.lang.native.sources import get_internal_artifact_lookup_source_url
from sentry.models import (
    ArtifactBundle,
    DebugIdArtifactBundle,
    Distribution,
    Project,
    ProjectArtifactBundle,
    Release,
    ReleaseArtifactBundle,
    ReleaseFile,
)
from sentry.utils import metrics

logger = logging.getLogger("sentry.api")

# The marker for "release" bundles
RELEASE_BUNDLE_TYPE = "release.bundle"
# The number of bundles ("artifact" or "release") that we query
MAX_BUNDLES_QUERY = 5
# The number of files returned by the `get_releasefiles` query
MAX_RELEASEFILES_QUERY = 10
# Number of days that determine whether an artifact bundle is ready for being renewed.
AVAILABLE_FOR_RENEWAL_DAYS = 30


@region_silo_endpoint
class ProjectArtifactLookupEndpoint(ProjectEndpoint):
    permission_classes = (ProjectReleasePermission,)

    def download_file(self, download_id, project: Project):
        ty, ty_id = download_id.split("/")

        rate_limited = ratelimits.is_limited(
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
        elif ty == "release_file":
            # NOTE: `ReleaseFile` does have a `project_id`, but that seems to
            # be always empty, so using the `organization_id` instead.
            file = (
                ReleaseFile.objects.filter(id=ty_id, organization_id=project.organization.id)
                .select_related("file")
                .first()
            )

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
        url = request.GET.get("url")
        release_name = request.GET.get("release")
        dist_name = request.GET.get("dist")

        used_artifact_bundles = dict()
        bundle_file_ids = set()

        def update_bundles(inner_bundles: Set[Tuple[int, datetime, int]]):
            for (bundle_id, date_added, file_id) in inner_bundles:
                used_artifact_bundles[bundle_id] = date_added
                bundle_file_ids.add(("artifact_bundle", bundle_id, file_id))

        if debug_id:
            bundles = get_artifact_bundles_containing_debug_id(debug_id, project)
            update_bundles(bundles)

        individual_files = set()
        if url and release_name and not bundle_file_ids:
            # Get both the newest X release artifact bundles,
            # and also query the legacy artifact bundles. One of those should have the
            # file we are looking for. We want to return more here, even bundles that
            # do *not* contain the file, rather than opening up each bundle. We want to
            # avoid opening up bundles at all cost.
            bundles = get_release_artifacts(project, release_name, dist_name)
            update_bundles(bundles)

            release, dist = try_resolve_release_dist(project, release_name, dist_name)
            if release:
                for (releasefile_id, file_id) in get_legacy_release_bundles(release, dist):
                    bundle_file_ids.add(("release_file", releasefile_id, file_id))
                individual_files = get_legacy_releasefile_by_file_url(release, dist, url)

        if options.get("sourcemaps.artifact-bundles.enable-renewal") == 1.0:
            with metrics.timer("artifact_lookup.get.renew_artifact_bundles"):
                # Before constructing the response, we want to update the artifact bundles renewal date.
                renew_artifact_bundles(used_artifact_bundles)

        # Then: Construct our response
        url_constructor = UrlConstructor(request, project)

        found_artifacts = []
        # NOTE: the reason we use the `file_id` as the `id` we return is because
        # downstream symbolicator relies on that for its internal caching.
        # We do not want to hard-refresh those caches quite yet, and the `id`
        # should also be as unique as possible, which the `file_id` is.
        for (ty, ty_id, file_id) in bundle_file_ids:
            found_artifacts.append(
                {
                    "id": str(file_id),
                    "type": "bundle",
                    "url": url_constructor.url_for_file_id(ty, ty_id),
                }
            )

        for release_file in individual_files:
            found_artifacts.append(
                {
                    "id": str(release_file.file.id),
                    "type": "file",
                    "url": url_constructor.url_for_file_id("release_file", release_file.id),
                    # The `name` is the url/abs_path of the file,
                    # as in: `"~/path/to/file.min.js"`.
                    "abs_path": release_file.name,
                    # These headers should ideally include the `Sourcemap` reference
                    "headers": release_file.file.headers,
                }
            )

        # make sure we have a stable sort order for tests
        found_artifacts.sort(key=lambda x: int(x["id"]))

        # NOTE: We do not paginate this response, as we have very tight limits on all the individual queries.
        return Response(serialize(found_artifacts, request.user))


def renew_artifact_bundles(used_artifact_bundles: Mapping[int, datetime]):
    # We take a snapshot in time that MUST be consistent across all updates.
    now = datetime.now(tz=pytz.UTC)
    # We compute the threshold used to determine whether we want to renew the specific bundle.
    threshold_date = now - timedelta(days=AVAILABLE_FOR_RENEWAL_DAYS)

    for (artifact_bundle_id, date_added) in used_artifact_bundles.items():
        metrics.incr("artifact_lookup.get.renew_artifact_bundles.should_be_renewed")
        # We perform the condition check also before running the query, in order to reduce the amount of queries to the
        # database.
        if date_added <= threshold_date:
            metrics.incr("artifact_lookup.get.renew_artifact_bundles.renewed")
            # We want to use a transaction, in order to keep the `date_added` consistent across multiple tables.
            with transaction.atomic():
                # We check again for the date_added condition in order to achieve consistency, this is done because
                # the `can_be_renewed` call is using a time which differs from the one of the actual update in the db.
                updated_rows_count = ArtifactBundle.objects.filter(
                    id=artifact_bundle_id, date_added__lte=threshold_date
                ).update(date_added=now)
                # We want to make cascading queries only if there were actual changes in the db.
                if updated_rows_count > 0:
                    ProjectArtifactBundle.objects.filter(
                        artifact_bundle_id=artifact_bundle_id, date_added__lte=threshold_date
                    ).update(date_added=now)
                    ReleaseArtifactBundle.objects.filter(
                        artifact_bundle_id=artifact_bundle_id, date_added__lte=threshold_date
                    ).update(date_added=now)
                    DebugIdArtifactBundle.objects.filter(
                        artifact_bundle_id=artifact_bundle_id, date_added__lte=threshold_date
                    ).update(date_added=now)


def get_artifact_bundles_containing_debug_id(
    debug_id: str, project: Project
) -> Set[Tuple[int, datetime, int]]:
    # We want to have the newest `File` for each `debug_id`.
    return set(
        ArtifactBundle.objects.filter(
            organization_id=project.organization.id,
            debugidartifactbundle__debug_id=debug_id,
        )
        .values_list("id", "date_added", "file_id")
        .order_by("-date_uploaded")[:1]
    )


def get_release_artifacts(
    project: Project,
    release_name: str,
    dist_name: Optional[str],
) -> Set[Tuple[int, datetime, int]]:
    return set(
        ArtifactBundle.objects.filter(
            organization_id=project.organization.id,
            projectartifactbundle__project_id=project.id,
            releaseartifactbundle__release_name=release_name,
            # In case no dist is provided, we will fall back to "" which is the NULL equivalent for our tables.
            # See `_create_artifact_bundle` in `src/sentry/tasks/assemble.py` for the reference.
            releaseartifactbundle__dist_name=dist_name or "",
        )
        .values_list("id", "date_added", "file_id")
        .order_by("-date_uploaded")[:MAX_BUNDLES_QUERY]
    )


def try_resolve_release_dist(
    project: Project, release_name: str, dist_name: Optional[str]
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
    except Exception as exc:
        logger.error("Failed to read", exc_info=exc)

    return release, dist


def get_legacy_release_bundles(
    release: Release, dist: Optional[Distribution]
) -> Set[Tuple[int, int]]:
    return set(
        ReleaseFile.objects.filter(
            release_id=release.id,
            dist_id=dist.id if dist else None,
            # a `ReleaseFile` with `0` artifacts represents a release archive,
            # see the comment above the definition of `artifact_count`.
            artifact_count=0,
            # similarly the special `type` is also used for release archives.
            file__type=RELEASE_BUNDLE_TYPE,
        )
        .select_related("file")
        .values_list("id", "file_id")
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

    def url_for_file_id(self, ty: str, file_id: int) -> str:
        # NOTE: Returning a self-route that requires authentication (via Bearer token)
        # is not really forward compatible with a pre-signed URL that does not
        # require any authentication or headers whatsoever.
        # This also requires a workaround in Symbolicator, as its generic http
        # downloader blocks "internal" IPs, whereas the internal Sentry downloader
        # is explicitly exempt.
        return f"{self.base_url}?download={ty}/{file_id}"
