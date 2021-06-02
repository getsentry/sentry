from django.core.exceptions import MultipleObjectsReturned, ObjectDoesNotExist
from django.db.models import Q

from sentry.api.bases.project import ProjectEndpoint
from sentry.api.endpoints.organization_release_files import load_dist
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.paginator import GenericOffsetPaginator
from sentry.api.serializers import serialize
from sentry.models import Release, ReleaseFile
from sentry.models.file import File
from sentry.models.releasefile import ReleaseArchive
from sentry.tasks.assemble import RELEASE_ARCHIVE_FILENAME, get_artifact_basename


class ProjectArchivedArtifactsEndpoint(ProjectEndpoint):
    def get(self, request, project, version):
        """
        List artifacts present in a Project's Release Archive
        ``````````````````````````````
        Retrieve a list of artifacts for a given release.
        Unlike ``ProjectReleaseFilesEndpoint``, this endpoint lists the contents
        of release-artifacts.zip.
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

        def on_results(r):
            results = serialize(load_dist(r), request.user)
            for result in results:
                result.pop("id")
            return results

        # Get contents of release archive as well:
        archive = release.get_release_archive()
        if archive is None:
            return self.paginate(
                request=request,
                queryset=[],
            )
        else:
            with archive:
                archived_list = list(get_pseudo_releasefiles(archive, query))

            def data_fn(offset, limit):
                return archived_list[offset : offset + limit]

            return self.paginate(
                request=request,
                on_results=on_results,
                paginator=GenericOffsetPaginator(data_fn=data_fn),
            )


def get_pseudo_releasefiles(archive, query):
    for filename, info in archive.manifest.get("files", {}).items():
        name = get_artifact_basename(info["url"])
        name_lower = name.lower()
        if not query or any(search_string.lower() in name_lower for search_string in query):
            yield ReleaseFile(
                name=name,
                file=File(headers=info.get("headers", {}), size=archive.get_file_size(filename)),
            )


class ListQuerySet:
    """ Pseudo queryset offering a subset of QuerySet operations """

    def __init__(self, release_files, query=None):
        self._files = [
            # Mimic "or" operation applied in ProjectReleaseFilesEndpoint:
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
