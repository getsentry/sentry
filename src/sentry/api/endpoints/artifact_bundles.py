from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.base import region_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint, ProjectReleasePermission
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers import serialize
from sentry.models import ArtifactBundle, ProjectArtifactBundle


@region_silo_endpoint
class ArtifactBundlesEndpoint(ProjectEndpoint):
    permission_classes = (ProjectReleasePermission,)

    def get(self, request: Request, project) -> Response:
        """
        List a Project's Artifact Bundles
        ````````````````````````````````````

        Retrieve a list of artifact bundles for a given project.

        :pparam string organization_slug: the slug of the organization the
                                          artifact bundle belongs to.
        :pparam string project_slug: the slug of the project to list the
                                     artifact bundles of.
        """
        try:
            queryset = ProjectArtifactBundle.objects.filter(
                organization_id=project.organization_id, project_id=project.id
            ).values("artifact_bundle_id", "date_added")
        except ProjectArtifactBundle.DoesNotExist:
            raise ResourceDoesNotExist

        def expose_artifact_bundle(artifact_bundle, artifact_bundle_meta):
            bundle_id, artifact_count = artifact_bundle_meta

            return {
                "type": "artifact_bundle",
                "bundleId": bundle_id,
                "date": artifact_bundle["date_added"],
                "fileCount": artifact_count,
            }

        def serialize_results(results):
            artifact_bundle_counts = ArtifactBundle.get_artifact_counts(
                [r["artifact_bundle_id"] for r in results]
            )

            # We want to maintain the -date_added ordering, thus we index the metadata by using the id fetched with the
            # first query.
            return serialize(
                [
                    expose_artifact_bundle(
                        artifact_bundle=r,
                        artifact_bundle_meta=artifact_bundle_counts[r["artifact_bundle_id"]],
                    )
                    for r in results
                    if r["artifact_bundle_id"] in artifact_bundle_counts
                ],
                request.user,
            )

        return self.paginate(
            request=request,
            queryset=queryset,
            order_by="-date_added",
            paginator_cls=OffsetPaginator,
            default_per_page=10,
            on_results=serialize_results,
        )
