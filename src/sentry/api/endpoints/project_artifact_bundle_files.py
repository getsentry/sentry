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
from sentry.models import (
    ArtifactBundle,
    ArtifactBundleArchive,
    ProjectArtifactBundle,
    SourceFileType,
)
from sentry.ratelimits.config import SENTRY_RATELIMITER_GROUP_DEFAULTS, RateLimitConfig

INVALID_SOURCE_FILE_TYPE = 0


class ArtifactBundleSource:
    def __init__(self, files: dict):
        self._files = files

    @cached_property
    def sorted_and_filtered_files(self) -> List[Tuple[str, dict]]:
        return sorted(list(self._files.items()))

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
        List files for a given project artifact bundle.
        ``````````````````````````````

        Retrieve a list of files for a given artifact bundle.

        :pparam string organization_slug: the slug of the organization the
                                          artifact bundle belongs to.
        :pparam string project_slug: the slug of the project the
                                     artifact bundle belongs to.
        :pparam string bundle_id: bundle_id of the artifact bundle to list files from.
        """
        query = request.GET.get("query")

        try:
            project_artifact_bundle = ProjectArtifactBundle.objects.filter(
                organization_id=project.organization.id,
                project_id=project.id,
                artifact_bundle__bundle_id=bundle_id,
            ).select_related("artifact_bundle__file")[0]
        except IndexError:
            return Response(
                {
                    "error": f"The artifact bundle with {bundle_id} is not bound to this project or doesn't exist"
                },
                status=400,
            )

        artifact_bundle = project_artifact_bundle.artifact_bundle

        try:
            # We open the archive to fetch the number of files.
            archive = ArtifactBundleArchive(artifact_bundle.file.getfile(), build_memory_map=False)
        except Exception:
            return Response(
                {"error": f"The archive of artifact bundle {bundle_id} can't be opened"}
            )

        def expose_artifact_bundle_file(file_path, info):
            headers = archive.normalize_headers(info.get("headers", {}))
            debug_id = archive.normalize_debug_id(headers.get("debug-id"))

            file_info = archive.get_file_info(file_path)

            file_type = SourceFileType.from_lowercase_key(info.get("type"))

            return {
                "id": base64.urlsafe_b64encode(bytes(file_path.encode("utf-8"))).decode("utf-8"),
                # In case the file type string was invalid, we return the sentinel value INVALID_SOURCE_FILE_TYPE.
                "fileType": file_type.value if file_type is not None else INVALID_SOURCE_FILE_TYPE,
                "filePath": file_path,
                "fileSize": file_info.file_size if file_info is not None else None,
                "debugId": debug_id,
            }

        def serialize_results(r):
            artifact_bundle_files = [
                expose_artifact_bundle_file(file_path, info) for file_path, info in r
            ]
            release, dist = ArtifactBundle.get_release_dist_pair(
                project.organization.id, artifact_bundle
            )

            return serialize(
                {
                    "bundleId": str(artifact_bundle.bundle_id),
                    "release": release,
                    "dist": dist if dist != "" else None,
                    "files": artifact_bundle_files,
                },
                request.user,
            )

        try:
            return self.paginate(
                request=request,
                sources=[ArtifactBundleSource(archive.get_files_by_file_path_or_debug_id(query))],
                paginator_cls=ChainPaginator,
                max_offset=MAX_ARTIFACT_BUNDLE_FILES_OFFSET,
                on_results=serialize_results,
            )
        except Exception as exc:
            raise exc
        finally:
            # We must close the archive before returning the value, otherwise we will get an error.
            archive.close()
