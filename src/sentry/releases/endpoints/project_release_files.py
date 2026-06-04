from __future__ import annotations

import logging
import re

from django.db import IntegrityError, router
from django.db.models import Q
from django.db.models.query import QuerySet
from django.utils.functional import cached_property
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import serializers
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import BaseEndpointMixin, cell_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint, ProjectReleasePermission
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.paginator import ChainPaginator
from sentry.api.serializers import serialize
from sentry.api.serializers.models.release_file import ReleaseFileSerializerResponse
from sentry.apidocs.constants import (
    RESPONSE_BAD_REQUEST,
    RESPONSE_CONFLICT,
    RESPONSE_FORBIDDEN,
    RESPONSE_NOT_FOUND,
    RESPONSE_UNAUTHORIZED,
)
from sentry.apidocs.parameters import CursorQueryParam, GlobalParams, ReleaseParams
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.constants import MAX_RELEASE_FILES_OFFSET
from sentry.debug_files.release_files import maybe_renew_releasefiles
from sentry.models.distribution import Distribution
from sentry.models.files.file import File
from sentry.models.release import Release
from sentry.models.releasefile import ReleaseFile, read_artifact_index
from sentry.ratelimits.config import SENTRY_RATELIMITER_GROUP_DEFAULTS, RateLimitConfig
from sentry.utils import metrics
from sentry.utils.db import atomic_transaction

ERR_FILE_EXISTS = "A file matching this name already exists for the given release"
_filename_re = re.compile(r"[\n\t\r\f\v\\]")


logger = logging.getLogger(__name__)


class ReleaseFileUploadSerializer(serializers.Serializer):
    """Documents the multipart/form-data body of the release file upload endpoints.

    The endpoints read the upload directly off ``request.data``; this serializer
    exists to describe the request body in the OpenAPI schema.
    """

    file = serializers.FileField(
        help_text="The multipart-encoded file contents to upload.",
    )
    name = serializers.CharField(
        required=False,
        help_text=(
            "The name (full path) the file will be referenced as, e.g. the full web "
            "URI of a JavaScript file. Defaults to the uploaded file's name."
        ),
    )
    dist = serializers.CharField(
        required=False,
        help_text="The name of the distribution to associate the file with.",
    )
    header = serializers.ListField(
        child=serializers.CharField(),
        required=False,
        help_text=(
            'Headers to attach to the file, each formatted as a `"key:value"` string '
            "(for example, to define a content type). May be supplied multiple times."
        ),
    )


def load_dist(results):
    # Dists are pretty uncommon.  In case they do appear load them now
    # as trying to join this on the DB does terrible things with large
    # offsets (it would otherwise generate a left outer join).
    dist_map = {}
    dist_ids = dict.fromkeys(x.dist_id for x in results)
    if not dist_ids:
        return results

    for d in Distribution.objects.filter(pk__in=dist_ids.keys()):
        dist_map[d.id] = d

    for result in results:
        if result.dist_id is not None:
            result_dist = dist_map.get(result.dist_id)
            if result_dist is not None:
                result.dist = result_dist

    return results


class ReleaseFilesMixin(BaseEndpointMixin):
    def get_releasefiles(self, request: Request, release, organization_id):
        query = request.GET.getlist("query")
        checksums = request.GET.getlist("checksum")

        data_sources: list[QuerySet[ReleaseFile] | ArtifactSource] = []

        # Exclude files which are also present in archive:
        file_list = ReleaseFile.public_objects.filter(release_id=release.id).exclude(
            artifact_count=0
        )
        file_list = file_list.select_related("file").order_by("name")

        if query:
            condition = Q(name__icontains=query[0])
            for name in query[1:]:
                condition |= Q(name__icontains=name)
            file_list = file_list.filter(condition)

        if checksums:
            condition = Q(file__checksum__in=checksums)
            file_list = file_list.filter(condition)

        data_sources.append(file_list.order_by("name"))

        # Get contents of release archive as well:
        dists = Distribution.objects.filter(organization_id=organization_id, release=release)
        for dist in list(dists) + [None]:
            try:
                # Only Read from artifact index if it has a positive artifact count
                artifact_index = read_artifact_index(release, dist, artifact_count__gt=0)
            except Exception:
                logger.exception("Failed to read artifact index")
                artifact_index = None

            if artifact_index is not None:
                files = artifact_index.get("files", {})
                source = ArtifactSource(dist, files, query, checksums)
                data_sources.append(source)

        def on_results(release_files: list[ReleaseFile]):
            # this should filter out all the "pseudo-ReleaseFile"s
            maybe_renew_releasefiles([rf for rf in release_files if rf.id])

            return serialize(load_dist(release_files), request.user)

        # NOTE: Returned release files are ordered by name within their block,
        # (i.e. per index file), but not overall
        return self.paginate(
            request=request,
            sources=data_sources,
            paginator_cls=ChainPaginator,
            max_offset=MAX_RELEASE_FILES_OFFSET,
            on_results=on_results,
        )

    @staticmethod
    def post_releasefile(request, release, logger):
        if "file" not in request.data:
            return Response({"detail": "Missing uploaded file"}, status=400)

        fileobj = request.data["file"]

        full_name = request.data.get("name", fileobj.name)
        if not full_name or full_name == "file":
            return Response({"detail": "File name must be specified"}, status=400)

        name = full_name.rsplit("/", 1)[-1]

        if _filename_re.search(name):
            return Response(
                {"detail": "File name must not contain special whitespace characters"}, status=400
            )

        headers = {"Content-Type": fileobj.content_type}
        for headerval in request.data.getlist("header") or ():
            try:
                k, v = headerval.split(":", 1)
            except ValueError:
                return Response({"detail": "header value was not formatted correctly"}, status=400)
            else:
                if _filename_re.search(v):
                    return Response(
                        {"detail": "header value must not contain special whitespace characters"},
                        status=400,
                    )
                headers[k] = v.strip()

        dist_name = request.data.get("dist")

        dist = None
        if dist_name:
            dist = release.add_dist(dist_name)

        # Quickly check for the presence of this file before continuing with
        # the costly file upload process.
        if ReleaseFile.objects.filter(
            organization_id=release.organization_id,
            release_id=release.id,
            name=full_name,
            dist_id=dist.id if dist else dist,
        ).exists():
            return Response({"detail": ERR_FILE_EXISTS}, status=409)

        file = File.objects.create(name=name, type="release.file", headers=headers)
        file.putfile(fileobj, logger=logger)

        metrics.incr("sourcemaps.upload.single_release_file")

        try:
            with atomic_transaction(using=router.db_for_write(ReleaseFile)):
                releasefile = ReleaseFile.objects.create(
                    organization_id=release.organization_id,
                    release_id=release.id,
                    file=file,
                    name=full_name,
                    dist_id=dist.id if dist else dist,
                )
        except IntegrityError:
            file.delete()
            return Response({"detail": ERR_FILE_EXISTS}, status=409)

        return Response(serialize(releasefile, request.user), status=201)


class ArtifactSource:
    """Provides artifact data to ChainPaginator on-demand"""

    def __init__(
        self, dist: Distribution | None, files: dict, query: list[str], checksums: list[str]
    ):
        self._dist = dist
        self._files = files
        self._query = query
        self._checksums = checksums

    @cached_property
    def sorted_and_filtered_files(self) -> list[tuple[str, dict]]:
        query = self._query
        checksums = self._checksums
        files = [
            # Mimic "or" operation applied for real querysets:
            (url, info)
            for url, info in self._files.items()
            if (not query or any(search_string.lower() in url.lower() for search_string in query))
            and (not checksums or any(checksum in info["sha1"] for checksum in checksums))
        ]
        files.sort(key=lambda item: item[0])

        return files

    def __len__(self) -> int:
        return len(self.sorted_and_filtered_files)

    def __getitem__(self, range):
        return [
            pseudo_releasefile(url, info, self._dist)
            for url, info in self.sorted_and_filtered_files[range]
        ]


def pseudo_releasefile(url, info, dist):
    """Create a pseudo-ReleaseFile from an ArtifactIndex entry"""
    return ReleaseFile(
        name=url,
        file=File(
            headers=info.get("headers", {}),
            size=info["size"],
            timestamp=info["date_created"],
            checksum=info["sha1"],
        ),
        dist_id=dist.id if dist else dist,
    )


@extend_schema(tags=["Releases"])
@cell_silo_endpoint
class ProjectReleaseFilesEndpoint(ProjectEndpoint, ReleaseFilesMixin):
    owner = ApiOwner.TELEMETRY_EXPERIENCE
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
        "POST": ApiPublishStatus.PRIVATE,
    }
    permission_classes = (ProjectReleasePermission,)
    rate_limits = RateLimitConfig(
        group="CLI", limit_overrides={"GET": SENTRY_RATELIMITER_GROUP_DEFAULTS["default"]}
    )

    @extend_schema(
        operation_id="List a Project Release's Files",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            GlobalParams.PROJECT_ID_OR_SLUG,
            ReleaseParams.VERSION,
            OpenApiParameter(
                name="query",
                location="query",
                required=False,
                type=str,
                many=True,
                description="If set, only files with these partial names will be returned.",
            ),
            OpenApiParameter(
                name="checksum",
                location="query",
                required=False,
                type=str,
                many=True,
                description="If set, only files with these exact checksums will be returned.",
            ),
            CursorQueryParam,
        ],
        responses={
            200: inline_sentry_response_serializer(
                "ListReleaseFiles", list[ReleaseFileSerializerResponse]
            ),
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
    )
    def get(
        self, request: Request, project, version
    ) -> Response[list[ReleaseFileSerializerResponse]]:
        """
        Retrieve a list of files for a given release.
        """
        try:
            release = Release.objects.get(
                organization_id=project.organization_id, projects=project, version=version
            )
        except Release.DoesNotExist:
            raise ResourceDoesNotExist

        return self.get_releasefiles(request, release, project.organization_id)

    @extend_schema(
        operation_id="Upload a New Project Release File",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            GlobalParams.PROJECT_ID_OR_SLUG,
            ReleaseParams.VERSION,
        ],
        request={"multipart/form-data": ReleaseFileUploadSerializer},
        responses={
            201: inline_sentry_response_serializer(
                "ReleaseFileResponse", ReleaseFileSerializerResponse
            ),
            400: RESPONSE_BAD_REQUEST,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
            409: RESPONSE_CONFLICT,
        },
    )
    def post(self, request: Request, project, version) -> Response[ReleaseFileSerializerResponse]:
        """
        Upload a new file for the given release.

        Files must be uploaded using the `multipart/form-data` content type, against the
        region-specific domain (e.g. `us.sentry.io` or `de.sentry.io`).
        """
        try:
            release = Release.objects.get(
                organization_id=project.organization_id, projects=project, version=version
            )
        except Release.DoesNotExist:
            raise ResourceDoesNotExist

        logger = logging.getLogger("sentry.files")
        logger.info("projectreleasefile.start")

        return self.post_releasefile(request, release, logger)
