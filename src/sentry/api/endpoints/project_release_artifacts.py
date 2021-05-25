from django.core.exceptions import MultipleObjectsReturned, ObjectDoesNotExist
from django.db.models import Q

from sentry.api.bases.project import ProjectEndpoint
from sentry.api.endpoints.organization_release_files import load_dist
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.paginator import (
    CombinedQuerysetIntermediary,
    CombinedQuerysetPaginator,
    OffsetPaginator,
)
from sentry.api.serializers import serialize
from sentry.constants import MAX_RELEASE_FILES_OFFSET
from sentry.models import Release, ReleaseFile
from sentry.models.file import File
from sentry.models.releasefile import ReleaseArchive
from sentry.tasks.assemble import RELEASE_ARCHIVE_FILENAME, get_artifact_basename


class ProjectReleaseArtifactsEndpoint(ProjectEndpoint):
    def get(self, request, project, version):
        """
        List a Project Release's Artifacts
        ``````````````````````````````

        Retrieve a list of artifacts for a given release.
        Unlike ``ProjectReleaseFilesEndpoint``, this endpoint lists the contents
        of release-artifacts.zip instead of the ZIP file itself.

        :pparam string organization_slug: the slug of the organization the
                                          release belongs to.
        :pparam string project_slug: the slug of the project to list the
                                     release files of.
        :pparam string version: the version identifier of the release.
        :qparam string query: If set, this parameter is used to search files.
        :auth: required
        """
        query = request.GET.getlist("query")

        try:
            release = Release.objects.get(
                organization_id=project.organization_id, projects=project, version=version
            )
        except Release.DoesNotExist:
            raise ResourceDoesNotExist

        file_list = (
            ReleaseFile.objects.filter(release=release)
            .exclude(name=RELEASE_ARCHIVE_FILENAME)
            .select_related("file")
            .order_by("name")
        )

        if query:
            if not isinstance(query, list):
                query = [query]

            condition = Q(name__icontains=query[0])
            for name in query[1:]:
                condition |= Q(name__icontains=name)
            file_list = file_list.filter(condition)

        on_results = lambda r: serialize(load_dist(r), request.user)

        # Get contents of release archive as well:
        try:
            release_archive_file = ReleaseFile.objects.select_related("file").get(
                release=release, name=RELEASE_ARCHIVE_FILENAME
            )
        except ResourceDoesNotExist:
            # Behave like ProjectReleaseFilesEndpoint
            return self.paginate(
                request=request,
                queryset=file_list,
                order_by="name",
                paginator_cls=OffsetPaginator,
                max_offset=MAX_RELEASE_FILES_OFFSET,
                on_results=on_results,
            )
        else:
            file_ = ReleaseFile.cache.getfile(release_archive_file)
            with ReleaseArchive(file_.file) as archive:
                archived_list = ReleaseArchiveQuerySet(archive, query)

            return self.paginate(
                request=request,
                intermediaries=[
                    CombinedQuerysetIntermediary(file_list, order_by=["name"]),
                    CombinedQuerysetIntermediary(archived_list, order_by=["name"]),
                ],
                paginator_cls=CombinedQuerysetPaginator,
                on_results=on_results,
            )


class ListQuerySet:
    """ Pseudo queryset offering a subset of QuerySet operations """

    def __init__(self, release_files, query=None):
        self._files = [
            # Mimic "or" operation applied for real querysets:
            rf
            for rf in release_files
            if not query or any(search_string.lower() in rf.name.lower() for search_string in query)
        ]

    def get(self):
        files = self._files
        if not files:
            raise ObjectDoesNotExist
        if len(files) > 1:
            raise MultipleObjectsReturned

        return files[0]

    def annotate(self, **kwargs):
        if kwargs:
            raise NotImplementedError

        return self

    def filter(self, **kwargs):
        if kwargs:
            raise NotImplementedError

        return self

    def order_by(self, key):
        return ListQuerySet(sorted(self._files, key=lambda f: getattr(f, key)))

    def __getitem__(self, index):
        if isinstance(index, int):
            return self._files[index]
        return ListQuerySet(self._files[index])


class ReleaseArchiveQuerySet(ListQuerySet):
    """ Pseudo queryset offering a subset of QuerySet operations, """

    def __init__(self, archive: ReleaseArchive, query=None):
        # Assume manifest
        release_files = [
            ReleaseFile(
                name=get_artifact_basename(info["url"]),
                file=File(headers=info.get("headers", {}), size=archive.get_file_size(filename)),
            )
            for filename, info in archive.manifest.get("files", {}).items()
        ]
        super().__init__(release_files, query)
