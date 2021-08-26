import logging
import re
from typing import List, Optional, Tuple

from django.db import IntegrityError, router
from django.db.models import Q
from django.utils.functional import cached_property
from rest_framework.response import Response

from sentry.api.bases.project import ProjectEndpoint, ProjectReleasePermission
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.paginator import ChainPaginator
from sentry.api.serializers import serialize
from sentry.constants import MAX_RELEASE_FILES_OFFSET
from sentry.models import Distribution, File, Release, ReleaseFile
from sentry.models.releasefile import read_artifact_index
from sentry.utils.db import atomic_transaction

ERR_FILE_EXISTS = "A file matching this name already exists for the given release"
_filename_re = re.compile(r"[\n\t\r\f\v\\]")


logger = logging.getLogger(__name__)


def load_dist(results):
    # Dists are pretty uncommon.  In case they do appear load them now
    # as trying to join this on the DB does terrible things with large
    # offsets (it would otherwise generate a left outer join).
    dists = dict.fromkeys(x.dist_id for x in results)
    if not dists:
        return results

    for dist in Distribution.objects.filter(pk__in=dists.keys()):
        dists[dist.id] = dist

    for result in results:
        if result.dist_id is not None:
            dist = dists.get(result.dist_id)
            if dist is not None:
                result.dist = dist

    return results


class ReleaseFilesMixin:
    def get_releasefiles(self, request, release, organization_id):
        query = request.GET.getlist("query")

        data_sources = []

        # Exclude files which are also present in archive:
        file_list = ReleaseFile.public_objects.filter(release_id=release.id).exclude(
            artifact_count=0
        )
        file_list = file_list.select_related("file").order_by("name")

        if query:
            if not isinstance(query, list):
                query = [query]

            condition = Q(name__icontains=query[0])
            for name in query[1:]:
                condition |= Q(name__icontains=name)
            file_list = file_list.filter(condition)

        data_sources.append(file_list.order_by("name"))

        # Get contents of release archive as well:
        dists = Distribution.objects.filter(organization_id=organization_id, release=release)
        for dist in list(dists) + [None]:
            try:
                # Only Read from artifact index if it has a positive artifact count
                artifact_index = read_artifact_index(release, dist, artifact_count__gt=0)
            except Exception as exc:
                logger.error("Failed to read artifact index", exc_info=exc)
                artifact_index = None

            if artifact_index is not None:
                files = artifact_index.get("files", {})
                source = ArtifactSource(dist, files, query)
                data_sources.append(source)

        def on_results(r):
            return serialize(load_dist(r), request.user)

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

        file = File.objects.create(name=name, type="release.file", headers=headers)
        file.putfile(fileobj, logger=logger)

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

    def __init__(self, dist: Optional[Distribution], files: dict, query: List[str]):
        self._dist = dist
        self._files = files
        self._query = query

    @cached_property
    def sorted_and_filtered_files(self) -> List[Tuple[str, dict]]:
        query = self._query
        files = [
            # Mimic "or" operation applied for real querysets:
            (url, info)
            for url, info in self._files.items()
            if not query or any(search_string.lower() in url.lower() for search_string in query)
        ]
        files.sort(key=lambda item: item[0])

        return files

    def __len__(self):
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


class ProjectReleaseFilesEndpoint(ProjectEndpoint, ReleaseFilesMixin):
    permission_classes = (ProjectReleasePermission,)

    def get(self, request, project, version):
        """
        List a Project Release's Files
        ``````````````````````````````

        Retrieve a list of files for a given release.

        :pparam string organization_slug: the slug of the organization the
                                          release belongs to.
        :pparam string project_slug: the slug of the project to list the
                                     release files of.
        :pparam string version: the version identifier of the release.
        :qparam string query: If set, this parameter is used to search files.
        :auth: required
        """
        try:
            release = Release.objects.get(
                organization_id=project.organization_id, projects=project, version=version
            )
        except Release.DoesNotExist:
            raise ResourceDoesNotExist

        return self.get_releasefiles(request, release, project.organization_id)

    def post(self, request, project, version):
        """
        Upload a New Project Release File
        `````````````````````````````````

        Upload a new file for the given release.

        Unlike other API requests, files must be uploaded using the
        traditional multipart/form-data content-type.

        The optional 'name' attribute should reflect the absolute path
        that this file will be referenced as. For example, in the case of
        JavaScript you might specify the full web URI.

        :pparam string organization_slug: the slug of the organization the
                                          release belongs to.
        :pparam string project_slug: the slug of the project to change the
                                     release of.
        :pparam string version: the version identifier of the release.
        :param string name: the name (full path) of the file.
        :param string dist: the name of the dist.
        :param file file: the multipart encoded file.
        :param string header: this parameter can be supplied multiple times
                              to attach headers to the file.  Each header
                              is a string in the format ``key:value``.  For
                              instance it can be used to define a content
                              type.
        :auth: required
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
