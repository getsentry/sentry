import base64
from typing import List, Tuple

from django.utils.functional import cached_property
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.base import region_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint, ProjectReleasePermission
from sentry.api.paginator import ChainPaginator
from sentry.api.serializers import serialize
from sentry.constants import MAX_ARTIFACT_BUNDLE_FILES_OFFSET
from sentry.models import ArtifactBundle, ArtifactBundleArchive, ProjectArtifactBundle
from sentry.ratelimits.config import SENTRY_RATELIMITER_GROUP_DEFAULTS, RateLimitConfig


class ArtifactBundleSource:
    def __init__(self, files: dict):
        self._files = files

    @cached_property
    def sorted_and_filtered_files(self) -> List[Tuple[str, dict]]:
        files = [(file_path, info) for file_path, info in self._files.items()]
        files.sort(key=lambda item: item[0])

        return files

    def __len__(self):
        return len(self.sorted_and_filtered_files)

    def __getitem__(self, range):
        return self.sorted_and_filtered_files[range]


@region_silo_endpoint
class ProjectArtifactBundleFilesEndpoint(ProjectEndpoint):
    permission_classes = (ProjectReleasePermission,)
    rate_limits = RateLimitConfig(
        group="CLI", limit_overrides={"GET": SENTRY_RATELIMITER_GROUP_DEFAULTS["default"]}
    )

    def get(self, request: Request, project, bundle_id) -> Response:
        """
        List a Project Artifact Bundle's Files
        ``````````````````````````````

        Retrieve a list of artifact bundle files for a given artifact bundle.

        :pparam string organization_slug: the slug of the organization the
                                          release belongs to.
        :pparam string project_slug: the slug of the project to list the
                                     release files of.
        :pparam string bundle_id: bundle_id of the artifact bundle to read contents from.
        """

        try:
            artifact_bundle = ArtifactBundle.objects.get(
                organization_id=project.organization.id, bundle_id=bundle_id
            )
        except ArtifactBundle.DoesNotExist:
            return Response(
                {"error": f"The artifact bundle with {bundle_id} does not exist"}, status=404
            )

        try:
            ProjectArtifactBundle.objects.get(
                project_id=project.id, artifact_bundle=artifact_bundle
            )
        except ProjectArtifactBundle.DoesNotExist:
            return Response(
                {"error": f"The artifact bundle with {bundle_id} is not bound to this project"},
                status=400,
            )

        # We open the archive to fetch the number of files.
        archive = ArtifactBundleArchive(artifact_bundle.file.getfile(), build_memory_map=False)

        def expose_artifact_bundle_file(file_path, info):
            headers = archive.normalize_headers(info.get("headers", {}))
            debug_id = archive.normalize_debug_id(headers.get("debug-id"))
            file_info = archive.get_file_info(file_path)

            return {
                "id": base64.b64encode(bytes(file_path.encode("utf-8"))),
                "type": info.get("type"),
                "filePath": file_path,
                "debugId": debug_id,
                "dateCreated": artifact_bundle.date_added.isoformat().replace("+00:00", "Z"),
                "size": file_info.file_size if file_info is not None else None,
            }

        def serialize_results(r):
            serialized_results = serialize(
                [expose_artifact_bundle_file(file_path, info) for file_path, info in r],
                request.user,
            )
            # We must close the archive once all the results have been fetched, otherwise we will get an error.
            archive.close()

            return serialized_results

        return self.paginate(
            request=request,
            sources=[ArtifactBundleSource(archive.manifest.get("files", {}))],
            paginator_cls=ChainPaginator,
            max_offset=MAX_ARTIFACT_BUNDLE_FILES_OFFSET,
            on_results=serialize_results,
        )
