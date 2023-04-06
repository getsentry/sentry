from typing import Dict, List

from django.utils.functional import cached_property
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.base import region_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint, ProjectReleasePermission
from sentry.api.paginator import ChainPaginator
from sentry.api.serializers import serialize
from sentry.api.serializers.models.artifactbundle import ArtifactBundleFilesSerializer
from sentry.constants import MAX_ARTIFACT_BUNDLE_FILES_OFFSET
from sentry.models import ArtifactBundle, ArtifactBundleArchive
from sentry.ratelimits.config import SENTRY_RATELIMITER_GROUP_DEFAULTS, RateLimitConfig


class ArtifactFile:
    def __init__(self, file_path: str, info: Dict[str, str]):
        self.file_path = file_path
        self.info = info

    def __eq__(self, other):
        return self.file_path == other.file_path

    def __hash__(self):
        return hash(self.file_path)

    def __lt__(self, other):
        return self.file_path < other.file_path


class ArtifactBundleSource:
    def __init__(self, files: dict):
        self._files = files

    @cached_property
    def sorted_and_filtered_files(self) -> List[ArtifactFile]:
        return sorted(
            [
                ArtifactFile(file_path=file_path, info=info)
                for file_path, info in self._files.items()
            ]
        )

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
            artifact_bundle = ArtifactBundle.objects.filter(
                organization_id=project.organization.id,
                bundle_id=bundle_id,
                projectartifactbundle__project_id=project.id,
            )[0]
        except IndexError:
            return Response(
                {
                    "error": f"The artifact bundle with {bundle_id} is not bound to this project or doesn't exist"
                },
                status=400,
            )

        try:
            # We open the archive to fetch the number of files.
            archive = ArtifactBundleArchive(artifact_bundle.file.getfile(), build_memory_map=False)
        except Exception:
            return Response(
                {"error": f"The archive of artifact bundle {bundle_id} can't be opened"}
            )

        def serialize_results(r):
            release, dist = ArtifactBundle.get_release_dist_pair(
                project.organization.id, artifact_bundle
            )

            return serialize(
                {
                    "bundleId": str(artifact_bundle.bundle_id),
                    "release": release,
                    "dist": dist if dist != "" else None,
                    "files": serialize(
                        # We need to convert the dictionary to a list in order to properly use the serializer.
                        r,
                        request.user,
                        ArtifactBundleFilesSerializer(archive),
                    ),
                },
                request.user,
            )

        try:
            return self.paginate(
                request=request,
                sources=[ArtifactBundleSource(archive.get_files_by_url_or_debug_id(query))],
                paginator_cls=ChainPaginator,
                max_offset=MAX_ARTIFACT_BUNDLE_FILES_OFFSET,
                on_results=serialize_results,
            )
        except Exception as exc:
            raise exc
        finally:
            # We must close the archive before returning the value, otherwise we will get an error.
            archive.close()
